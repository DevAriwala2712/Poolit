import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Failed writes are already reported to the vendor via a toast (see
// StoreProvider onMutationError); don't also spam the console as "uncaught".
window.addEventListener("unhandledrejection", (e) => {
  if ((e.reason as { name?: string } | null)?.name === "ApiError") e.preventDefault();
});

// Installable PWA + offline app shell. Production only: in dev the SW would
// cache Vite's modules and fight HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
