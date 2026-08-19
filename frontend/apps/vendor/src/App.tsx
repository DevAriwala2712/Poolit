import { StoreProvider } from "@poolit/domain";
import { Navigate, Route, Routes } from "react-router-dom";
import { ConnectionGate } from "./components/ConnectionGate";
import { Shell } from "./components/Shell";
import { Analytics } from "./screens/Analytics";
import { Dashboard } from "./screens/Dashboard";
import { Inventory } from "./screens/Inventory";
import { Orders } from "./screens/Orders";
import { Settings } from "./screens/Settings";
import { VendorProvider } from "./state/VendorContext";

export default function App() {
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
