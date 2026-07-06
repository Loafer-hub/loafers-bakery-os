import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import App from "./App";
import "./styles.css";
import "./owner-card-contrast.css";
import "./mobile-layout.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

async function configureNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setOverlaysWebView({ overlay: false }),
  ]);

  await SplashScreen.hide();
}

configureNativeShell();

if ("serviceWorker" in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
