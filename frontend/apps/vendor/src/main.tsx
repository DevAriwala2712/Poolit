import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { BACKEND, ErrorBoundary, installErrorReporting, setRpcCaller } from "@poolit/domain";
import App from "./App";
import "./index.css";
import { supabase } from "./lib/supabaseClient";

// VITE_BACKEND=supabase: data calls go straight to the database functions through
// this client (the same one that holds the vendor's login). Default: the Express API.
if (BACKEND === "supabase") setRpcCaller(async (fn, args) => await supabase.rpc(fn, args));

// Crashes are reported to Poolit (new backend only), so they are seen without anyone having to complain.
installErrorReporting("vendor");

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
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
