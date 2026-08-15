// Where the signed APK and its install guide live. Both paths are produced by
// the Android build (see artifacts/android/scripts/publish-apk.mjs), and the
// filename deliberately has no version in it so links never go stale.
export const APK_DOWNLOAD_PATH = "/download/rajesh-shop.apk";
export const APK_GUIDE_PATH = "/app/";

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function isIos(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * True when the page is already running inside the packaged Android app, where
 * the shell sets this global before any app code. Offering someone a download
 * of the app they are currently using is pure noise.
 */
export function isInsideApp(): boolean {
  return typeof window !== "undefined" && Boolean((window as { __RAJESH_NATIVE__?: boolean }).__RAJESH_NATIVE__);
}

/** Android phones in a browser — the only place the APK is worth offering. */
export function canInstallApk(): boolean {
  return isAndroid() && !isInsideApp();
}
