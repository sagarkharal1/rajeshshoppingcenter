/*
 * Runs before any app code inside the packaged Android app.
 *
 * The web bundle was written for a server that hosts both the pages and the
 * API on one origin, so ~21 places call fetch("/api/...") with a relative path.
 * Inside the APK the pages are served from https://localhost by the WebView,
 * and those relative calls would resolve to https://localhost/api/... and fail.
 *
 * Rewriting them here keeps that assumption working without editing the web
 * app in 15 places. This file is only ever copied into the APK bundle — it is
 * never served from the website, so it does not need a guard for that case.
 *
 * ORIGIN is rewritten at build time by scripts/prepare-web.mjs.
 */
(function () {
  "use strict";

  var ORIGIN = "__API_ORIGIN__";
  var APP_VERSION = "__APP_VERSION__";
  var APP_VERSION_CODE = __APP_VERSION_CODE__;

  // Read by getImageUrl() in the web app, which builds <img src> paths that a
  // fetch patch can never reach.
  window.__RAJESH_API_ORIGIN__ = ORIGIN;
  window.__RAJESH_APP_VERSION__ = APP_VERSION;
  window.__RAJESH_APP_VERSION_CODE__ = APP_VERSION_CODE;
  window.__RAJESH_NATIVE__ = true;

  function absolutise(url) {
    // Only bare paths need help. Anything already absolute, or a data:/blob:
    // URL, is left exactly as it was.
    return typeof url === "string" && url.charAt(0) === "/" && url.charAt(1) !== "/"
      ? ORIGIN + url
      : url;
  }

  var nativeFetch = window.fetch;

  window.fetch = function (input, init) {
    try {
      if (typeof input === "string") {
        input = absolutise(input);
      } else if (input instanceof Request) {
        var moved = absolutise(input.url);
        if (moved !== input.url) {
          input = new Request(moved, input);
        }
      } else if (typeof URL !== "undefined" && input instanceof URL) {
        // A URL object is already absolute — it resolved against the WebView
        // origin when it was constructed, so repair it rather than skip it.
        if (input.origin === window.location.origin) {
          input = ORIGIN + input.pathname + input.search + input.hash;
        }
      }
    } catch (error) {
      // A rewrite failure must never take down the request. Fall through with
      // whatever we were handed and let the network report the real problem.
    }

    return nativeFetch.call(this, input, init);
  };

  // A few libraries (and the OCR path) still reach for XMLHttpRequest.
  var nativeOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = absolutise(url);
    return nativeOpen.apply(this, args);
  };
})();
