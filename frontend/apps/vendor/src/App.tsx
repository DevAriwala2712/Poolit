import { StoreProvider } from "@poolit/domain";
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-black p-2">
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
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </VendorProvider>
      </ConnectionGate>
    </StoreProvider>
  );
}
