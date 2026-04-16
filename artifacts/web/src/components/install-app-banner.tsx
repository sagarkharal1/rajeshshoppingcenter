import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { DeferredInstallPromptEvent } from "@/lib/pwa";
import { useLanguage } from "@/lib/language";

export function InstallAppBanner() {
  const { lang } = useLanguage();
  const [promptEvent, setPromptEvent] = useState<DeferredInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as DeferredInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (dismissed) return null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const showIosHelp = isIos && !promptEvent;
  const showPrompt = Boolean(promptEvent);
  if (!showPrompt && !showIosHelp) return null;

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setPromptEvent(null);
      setDismissed(true);
    }
  };

  return (
    <div className="mx-auto mb-4 max-w-6xl px-4 sm:px-6">
      <div className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-2xl bg-white/70 p-2">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">
              {lang === "ne" ? "मोबाइलमा एप जस्तै राख्नुहोस्" : "Install this app on your phone"}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-900/85">
              {showPrompt
                ? lang === "ne"
                  ? "यसलाई होम स्क्रिनमा राखेर एप आइकनबाट सीधा खोल्न सकिन्छ।"
                  : "Add it to your home screen and open it from an app icon."
                : lang === "ne"
                  ? "iPhone मा Share बटन थिचेर “Add to Home Screen” गर्नुहोस्।"
                  : "On iPhone, tap Share and choose “Add to Home Screen”."}
            </p>
            {showPrompt ? (
              <button onClick={install} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
                <Download className="h-4 w-4" />
                {lang === "ne" ? "एप इन्स्टल गर्नुहोस्" : "Install app"}
              </button>
            ) : null}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="rounded-full p-1 text-amber-900/70">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
