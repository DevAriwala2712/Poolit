import { Route, Routes } from "react-router-dom";
import { StoreProvider } from "./domain/store";
import { HostelSelect } from "./routes/student/HostelSelect";
import { SlotScreen } from "./routes/student/SlotScreen";
import { VendorDashboard } from "./routes/vendor/Dashboard";
import { Inventory } from "./routes/vendor/Inventory";
import { SlotDetail } from "./routes/vendor/SlotDetail";
import { VendorLayout } from "./routes/vendor/VendorLayout";

function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route path="/" element={<HostelSelect />} />
        <Route path="/student/:hostelId" element={<SlotScreen />} />
        <Route path="/vendor" element={<VendorLayout />}>
          <Route index element={<VendorDashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="slot/:slotId" element={<SlotDetail />} />
        </Route>
      </Routes>
    </StoreProvider>
  );
}

export default App;
