import { StoreProvider } from "@poolit/domain";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ConnectionGate } from "./components/ConnectionGate";
import { TabBar } from "./components/TabBar";
import { Cart } from "./screens/Cart";
import { Categories } from "./screens/Categories";
import { Checkout } from "./screens/Checkout";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";
import { Orders } from "./screens/Orders";
import { ProductDetail } from "./screens/ProductDetail";
import { Profile } from "./screens/Profile";
import { Tracking } from "./screens/Tracking";
import { CartProvider } from "./state/CartContext";
import { ProfileProvider, useProfile } from "./state/ProfileContext";
import { ToastProvider } from "./state/ToastContext";

/** Phone-width canvas; centred with soft edges on larger screens. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-cream shadow-[0_0_60px_rgb(28_27_25/0.08)]">
      {children}
    </div>
  );
}

/** Routes that show the bottom tab bar. */
function TabLayout() {
  return (
    <Frame>
      <div className="pb-[calc(56px+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <TabBar />
    </Frame>
  );
}

/** Full-bleed routes (no tab bar). */
function PlainLayout() {
  return (
    <Frame>
      <Outlet />
    </Frame>
  );
}

function RequireOnboarding() {
  const { profile } = useProfile();
  if (!profile.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <StoreProvider>
      <ProfileProvider>
        <CartProvider>
          <ToastProvider>
            <ConnectionGate>
            <Routes>
              <Route
                path="/onboarding"
                element={
                  <Frame>
                    <Onboarding />
                  </Frame>
                }
              />

              <Route element={<RequireOnboarding />}>
                <Route element={<TabLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>

                <Route element={<PlainLayout />}>
                  <Route path="/product/:itemId" element={<ProductDetail />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/track/:orderId" element={<Tracking />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ConnectionGate>
          </ToastProvider>
        </CartProvider>
      </ProfileProvider>
    </StoreProvider>
  );
}
