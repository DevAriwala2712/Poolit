import { StoreProvider } from "@poolit/domain";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ConnectionGate } from "./components/ConnectionGate";
import { LogoMark } from "./components/LogoMark";
import { Shell } from "./components/Shell";
import { Analytics } from "./screens/Analytics";
import { Dashboard } from "./screens/Dashboard";
import { Inventory } from "./screens/Inventory";
import { Login } from "./screens/Login";
import { Orders } from "./screens/Orders";
import { Settings } from "./screens/Settings";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { UIModeProvider, useUIMode } from "./state/UIModeContext";
import { VendorProvider } from "./state/VendorContext";

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface">
        <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-[#141A2C] p-2">
          <LogoMark className="h-full w-full" />
        </span>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <StoreProvider>
      <ConnectionGate>
        <VendorProvider>
          <UIModeProvider>
            <Routes>
              <Route element={<Shell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/analytics" element={<AdvancedOnly><Analytics /></AdvancedOnly>} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </UIModeProvider>
        </VendorProvider>
      </ConnectionGate>
    </StoreProvider>
  );
}

/**
 * Analytics is an advanced-only screen. Guard the route itself (not just the
 * sidebar link) so a stale deep link or the back button can't land a Basic
 * mode user on it — see docs on Basic/Advanced mode in the Settings screen.
 */
function AdvancedOnly({ children }: { children: ReactNode }) {
  const { advancedMode } = useUIMode();
  return advancedMode ? <>{children}</> : <Navigate to="/" replace />;
}
