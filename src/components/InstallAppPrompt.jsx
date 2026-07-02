import { Bell, Download, Smartphone, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LOAFERS_BRAND } from "../lib/brand";

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function isSmallTouchDevice() {
  return window.matchMedia?.("(max-width: 760px)")?.matches
    || window.matchMedia?.("(pointer: coarse)")?.matches;
}

export function InstallAppPrompt({ context = "owner" }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(isStandaloneApp);
  const storageKey = `loafers-install-card-dismissed-${context}`;
  const ios = useMemo(isIosDevice, []);
  const showInstructionOnly = ios && isSmallTouchDevice();

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [storageKey]);

  if (installed || dismissed || (!promptEvent && !showInstructionOnly)) return null;

  async function installApp() {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
  }

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Dismissal is just a convenience.
    }
  }

  return (
    <section className="install-app-card" aria-label={`Install ${LOAFERS_BRAND.shortName} as an app`}>
      <span className="install-app-icon"><Smartphone size={19} /></span>
      <div>
        <strong>{context === "customer" ? "Save this order page" : `Install ${LOAFERS_BRAND.shortName} on this device`}</strong>
        <p>
          {showInstructionOnly
            ? "On iPhone: tap Share, then Add to Home Screen. It opens like an app and keeps the bakery tools handy."
            : "Add it to your home screen for faster opening, app-style display, and better offline fallback."}
        </p>
        <small><WifiOff size={12} /> Offline shell ready · <Bell size={12} /> push notifications can plug in later</small>
      </div>
      <div className="install-app-actions">
        {promptEvent ? <button type="button" onClick={installApp}><Download size={14} /> Install</button> : null}
        <button type="button" onClick={dismiss} aria-label="Dismiss install card"><X size={14} /></button>
      </div>
    </section>
  );
}
