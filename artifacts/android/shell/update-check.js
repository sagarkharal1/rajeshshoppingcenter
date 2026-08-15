/*
 * Tells the customer when a newer APK exists.
 *
 * Nothing installs this app for them — it arrived over Bluetooth or a download
 * link, so there is no store to push updates. Without this, a phone keeps the
 * version it was given forever and the shop has no way to reach it.
 *
 * Deliberately quiet: a failed check shows nothing at all. On a village
 * connection a check will fail often, and "could not check for updates" is
 * noise the customer can do nothing about.
 */
(function () {
  "use strict";

  var ORIGIN = window.__RAJESH_API_ORIGIN__;
  var CURRENT = window.__RAJESH_APP_VERSION_CODE__;
  var LANG_KEY = "rajesh_web_lang_v2";
  var SEEN_KEY = "rajesh_update_dismissed_code";
  var CHECK_TIMEOUT_MS = 8000;

  var TEXT = {
    ne: {
      title: "नयाँ संस्करण आयो",
      body: "एपको नयाँ संस्करण उपलब्ध छ। डाउनलोड गरेर पुरानो माथि नै इन्स्टल गर्नुहोस् — तपाईंको कुनै जानकारी हराउँदैन।",
      download: "डाउनलोड गर्नुहोस्",
      later: "पछि",
    },
    en: {
      title: "A new version is available",
      body: "Download it and install over the old one — nothing you have saved is lost.",
      download: "Download",
      later: "Later",
    },
  };

  function language() {
    try {
      return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ne";
    } catch (error) {
      return "ne";
    }
  }

  function alreadyDismissed(code) {
    try {
      return Number(localStorage.getItem(SEEN_KEY)) === code;
    } catch (error) {
      return false;
    }
  }

  function remember(code) {
    try {
      localStorage.setItem(SEEN_KEY, String(code));
    } catch (error) {
      // A full or blocked localStorage only means the notice shows again later.
    }
  }

  function show(info) {
    var t = TEXT[language()];

    var bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText = [
      "position:fixed",
      "left:12px",
      "right:12px",
      "bottom:12px",
      "z-index:2147483000",
      "background:#173563",
      "color:#fff",
      "border-radius:18px",
      "padding:16px",
      "box-shadow:0 10px 30px rgba(0,0,0,.35)",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "line-height:1.5",
    ].join(";");

    var title = document.createElement("p");
    title.textContent = t.title;
    title.style.cssText = "margin:0 0 4px;font-weight:700;font-size:15px";

    var body = document.createElement("p");
    body.textContent = info.notes && info.notes[language()] ? info.notes[language()] : t.body;
    body.style.cssText = "margin:0 0 12px;font-size:13px;opacity:.9";

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px";

    var download = document.createElement("a");
    download.textContent = t.download;
    download.href = info.downloadUrl || ORIGIN + "/app";
    // Hand the link to the phone's browser. The WebView has no download UI, so
    // opening it here would look like a dead tap.
    download.target = "_blank";
    download.rel = "noopener noreferrer";
    download.style.cssText =
      "flex:1;text-align:center;background:#f5b301;color:#173563;font-weight:700;" +
      "padding:11px;border-radius:12px;text-decoration:none;font-size:14px";

    var later = document.createElement("button");
    later.type = "button";
    later.textContent = t.later;
    later.style.cssText =
      "background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);" +
      "padding:11px 16px;border-radius:12px;font-size:14px;cursor:pointer";

    later.addEventListener("click", function () {
      remember(info.versionCode);
      bar.remove();
    });

    row.appendChild(download);
    row.appendChild(later);
    bar.appendChild(title);
    bar.appendChild(body);
    bar.appendChild(row);
    document.body.appendChild(bar);
  }

  function check() {
    if (typeof CURRENT !== "number") return;

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, CHECK_TIMEOUT_MS);

    fetch(ORIGIN + "/app-version.json", { cache: "no-store", signal: controller.signal })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (info) {
        if (!info || typeof info.versionCode !== "number") return;
        if (info.versionCode <= CURRENT) return;
        if (alreadyDismissed(info.versionCode)) return;
        show(info);
      })
      .catch(function () {
        // Offline, slow, or the file is not published yet. Stay silent.
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  // Let the storefront paint and settle first — the update notice is never
  // more urgent than the shop itself loading.
  if (document.readyState === "complete") {
    setTimeout(check, 3000);
  } else {
    window.addEventListener("load", function () {
      setTimeout(check, 3000);
    });
  }
})();
