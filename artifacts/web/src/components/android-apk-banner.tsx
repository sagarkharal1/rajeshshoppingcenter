import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { APK_DOWNLOAD_PATH, APK_GUIDE_PATH, canInstallApk } from "@/lib/platform";

const DISMISSED_KEY = "rajesh_apk_banner_dismissed";

/**
 * Offers the installable Android app to customers browsing on an Android phone.
 *
 * Deliberately narrow: it never shows on a desktop, on an iPhone (sideloading
 * is not possible there), or inside the packaged app itself. The install guide
 * sits one tap away because Android shows a Play Protect warning for anything
 * that did not come from the Play Store, and a customer who hits that with no
 * explanation simply stops.
 */
export function AndroidApkBanner() {
  const { lang } = useLanguage();
  const [show, setShow] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!canInstallApk()) return;

    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Blocked storage only means the banner can reappear later.
    }

    setShow(true);

    // Published by the Android build. Missing or unreachable simply means no
    // version number is shown — never a reason to hide the download.
    fetch("/app-version.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((info) => {
        if (info?.versionName) setVersion(String(info.versionName));
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do — it will just show again next visit.
    }
  };

  const text =
    lang === "ne"
      ? {
          title: "एन्ड्रोइड एप डाउनलोड गर्नुहोस्",
          body: "इन्टरनेट ढिलो भए पनि छिटो चल्छ। फोनमा एप जस्तै राख्नुहोस्।",
          download: "एप डाउनलोड",
          guide: "कसरी इन्स्टल गर्ने?",
          close: "बन्द गर्नुहोस्",
        }
      : {
          title: "Get the Android app",
          body: "Opens fast even on slow internet, and sits on your home screen.",
          download: "Download app",
          guide: "How to install",
          close: "Close",
        };

  return (
    <div className="mx-auto mb-3 max-w-6xl px-4 sm:px-6">
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-950 shadow-sm">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 shrink-0 rounded-xl bg-white/80 p-2">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-tight">
              {text.title}
              {version ? <span className="ml-1.5 text-xs font-semibold opacity-70">v{version}</span> : null}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-900/85">{text.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={APK_DOWNLOAD_PATH}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                {text.download}
              </a>
              <a
                href={APK_GUIDE_PATH}
                className="inline-flex items-center rounded-xl border border-amber-300 bg-white/70 px-3 py-2.5 text-sm font-semibold text-amber-950"
              >
                {text.guide}
              </a>
            </div>
          </div>
        </div>
        <button onClick={dismiss} className="shrink-0 rounded-full p-1 text-amber-900/70" aria-label={text.close}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
