import type { CapacitorConfig } from "@capacitor/cli";

// The web assets are copied into ./www by scripts/prepare-web.mjs rather than
// pointed at ../web/dist/public directly. The copy step is where the API shim
// gets injected, and it keeps Capacitor from writing into the web build output.
const config: CapacitorConfig = {
  appId: "np.com.rajeshshoppingcenter.app",
  appName: "Rajesh Shopping Center",
  webDir: "www",
  android: {
    // Every request the app makes goes to https://rajeshshoppingcenter.com.np.
    // There is no reason to ever load http:// content, and allowing it would
    // let a hostile network on a shared village connection inject into the app.
    allowMixedContent: false,
  },
  server: {
    // Serving from https://localhost rather than file:// keeps localStorage,
    // the camera barcode scanner, and fetch working under a secure origin.
    //
    // It also means window.location.hostname === "localhost" inside the app,
    // which registerPwaServiceWorker() already treats as local and skips. The
    // service worker stays out of the APK for free — assets are bundled in the
    // package already, so caching them a second time would only add staleness.
    androidScheme: "https",
  },
};

export default config;
