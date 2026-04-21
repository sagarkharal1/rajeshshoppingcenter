import { useCallback, useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { DeferredInstallPromptEvent } from "@/lib/pwa";
import { useLanguage } from "@/lib/language";

export const INSTALL_APP_EVENT = "rajesh-shopping-center:install-app";

export function InstallAppBanner() {
  const { lang } = useLanguage();
  const [promptEvent, setPromptEvent] = useState<DeferredInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [forcedHelp, setForcedHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as DeferredInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const install = useCallback(async () => {
    setDismissed(false);
    setForcedHelp(true);
    if (!promptEvent) return;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setPromptEvent(null);
      setDismissed(true);
      setForcedHelp(false);
    }
  }, [promptEvent]);

  useEffect(() => {
    const onInstallRequest = () => {
      void install();
    };

    window.addEventListener(INSTALL_APP_EVENT, onInstallRequest);
    return () => window.removeEventListener(INSTALL_APP_EVENT, onInstallRequest);
  }, [install]);

  if (dismissed) return null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const showPrompt = Boolean(promptEvent);
  const showIosHelp = isIos && !promptEvent;
  if (!showPrompt && !showIosHelp && !forcedHelp) return null;

  return (
    <div className="mx-auto mb-4 max-w-6xl px-4 sm:px-6">
      <div className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-2xl bg-white/70 p-2">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">{lang === "ne" ? "मोबाइलमा एप जस्तै राख्नुहोस्" : "Install this app on your phone"}</p>
            <p className="mt-1 text-sm leading-6 text-amber-900/85">
              {showPrompt
                ? lang === "ne"
                  ? "यसलाई होम स्क्रिनमा राखेर एप आइकनबाट सीधा खोल्न सकिन्छ।"
                  : "Add it to your home screen and open it from an app icon."
                : lang === "ne"
                  ? "यदि डाउनलोड बटन खुलेन भने Chrome/Edge को मेनुबाट Install app वा Add to Home screen रोज्नुहोस्। iPhone मा Share खोलेर Add to Home Screen रोज्नुहोस्।"
                  : "If the install prompt does not open, use your browser menu and choose Install app or Add to Home Screen. On iPhone, use Share and Add to Home Screen."}
            </p>
            <button onClick={install} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
              <Download className="h-4 w-4" />
              {lang === "ne" ? "एप डाउनलोड गर्नुहोस्" : "Download app"}
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="rounded-full p-1 text-amber-900/70" aria-label={lang === "ne" ? "बन्द गर्नुहोस्" : "Close"}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
