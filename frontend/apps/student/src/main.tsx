import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { BACKEND, ErrorBoundary, installErrorReporting, setRpcCaller } from "@poolit/domain";
import App from "./App";
import "./index.css";
import { supabase } from "./lib/supabaseClient";

// VITE_BACKEND=supabase: data calls go straight to the database functions through
// this client (the same one that holds the student's login). Default: the Express API.
if (BACKEND === "supabase") setRpcCaller(async (fn, args) => await supabase.rpc(fn, args));

// Crashes are reported to Poolit (new backend only), so they are seen without anyone having to complain.
installErrorReporting("student");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
