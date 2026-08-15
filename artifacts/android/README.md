# Android app (sideloaded APK)

Packages the existing web storefront (`artifacts/web`) as an installable
Android app, for sharing by Bluetooth, ShareIt, WhatsApp or a download link.
There is no Play Store listing.

This is a **shell, not a second app**. There is no separate UI to maintain —
whatever ships in `artifacts/web` is what the APK shows. `artifacts/mobile` is
an unrelated, stale Expo project and is not used here.

## Why the shell exists at all

Inside the APK, Capacitor serves the pages from `https://localhost`. The web
app was written for a server that hosts pages and API on one origin, so its
~21 relative `fetch("/api/...")` calls would resolve to `https://localhost/api`
and fail. `shell/api-origin.js` is injected ahead of the app bundle and rewrites
those to the live server. `getImageUrl()` in the web app reads the same origin,
because a raw `<img src>` is never seen by a fetch patch.

Two things fall out of serving from `localhost` that are worth knowing:

- `registerPwaServiceWorker()` already skips `localhost`, so the service worker
  stays out of the app. That is what we want — assets are bundled in the APK,
  and a second cache layer would only serve stale pages after an update.
- The API must allow cross-origin requests. It already does (`app.use(cors())`),
  and auth is a `Bearer` token in `localStorage` rather than a cookie, so
  nothing breaks on the origin change.

## Build

```bash
pnpm --filter @workspace/web run build
pnpm --filter @workspace/android run build:release
pnpm --filter @workspace/android run publish-apk
```

`build:release` stages the web build into `www/`, injects the shim, and runs
Gradle. `publish-apk` copies the signed APK to
`artifacts/web/public/download/rajesh-shop.apk` so the site serves it.

Requires JDK 21 and the Android SDK (`ANDROID_HOME`), with build-tools 35+ and
platform android-36.

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Testing without a phone

```bash
pnpm --filter @workspace/android run serve-www
```

Serves the staged `www/` — the exact payload inside the APK — on
<http://localhost:4173>. The origin is `localhost` and API calls go
cross-origin to the live server, which is what the app does on a phone.

## Releasing an update

A sideloaded app is never updated for anyone. `shell/update-check.js` compares
the running version against `app-version.json` published on the website and
shows a bilingual notice with a download link when a newer one exists. It stays
silent on any failure, because a village connection fails often and the
customer can do nothing about it.

To ship an update:

1. Bump **both** `versionCode` and `versionName` in `app-version.json`.
   `versionCode` must increase or Android refuses the install.
2. Rebuild and `publish-apk`.
3. Deploy the site. `prepare-web.mjs` copies `app-version.json` into
   `artifacts/web/public/`, so the deploy is what tells existing installs an
   update exists.

## The keystore — read this

`rajesh-release.keystore` and `keystore.properties` sit in this folder and are
git-ignored.

Android identifies an app by its signing key. An update installs over an
existing app only when both are signed by the **same** key. If these two files
are lost, every customer must uninstall and reinstall before they can take
another update.

**Back both files up somewhere off this machine.** They are the only copies.

To create them (refuses to overwrite an existing keystore):

```bash
pnpm --filter @workspace/android run make-keystore
```

## Known limits

- **iPhone is not covered.** Sideloading on iOS needs a developer certificate
  that expires every 7 days. iPhone users get the PWA — the install banner on
  the website already handles them.
- **Play Protect warns on install.** Normal for any APK that did not come from
  the Play Store. `artifacts/web/public/app/index.html` walks customers through
  it in Nepali and English.
- **The APK is committed with the site**, adding ~10 MB per release to the
  repository permanently. If that becomes a problem, host it on GitHub Releases
  and repoint the download page.
