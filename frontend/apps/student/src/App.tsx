import { BACKEND, StoreProvider } from "@poolit/domain";
import { useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ConnectionGate } from "./components/ConnectionGate";
import { TabBar } from "./components/TabBar";
import { Cart } from "./screens/Cart";
import { Categories } from "./screens/Categories";
import { Checkout } from "./screens/Checkout";
import { Consent } from "./screens/Consent";
import { Home } from "./screens/Home";
import { Legal } from "./screens/Legal";
import { Login } from "./screens/Login";
import { Onboarding } from "./screens/Onboarding";
import { Orders } from "./screens/Orders";
import { ProductDetail } from "./screens/ProductDetail";
import { Profile } from "./screens/Profile";
import { Tracking } from "./screens/Tracking";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { CartProvider } from "./state/CartContext";
import { ProfileProvider, useProfile } from "./state/ProfileContext";
import { hasConsented } from "./lib/policy";
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

/**
 * Browsing is open to everyone; ordering and order history need a phone
 * sign-in (so orders belong to an account, not to a typed name).
 */
function RequireSignIn() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/**
 * Signed-in students confirm they are 18+ and accept the current Terms and Privacy Policy once
 * (and again when the version changes). The acceptance is saved on the server. Only on the new
 * backend, which is where the record can be kept.
 */
function RequireConsent() {
  const { session } = useAuth();
  const [, setTick] = useState(0);
  if (BACKEND !== "supabase" || !session || hasConsented(session.user.id)) return <Outlet />;
  return (
    <Frame>
      <Consent userId={session.user.id} onDone={() => setTick((n) => n + 1)} />
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
    <StoreProvider mode="student">
      <ProfileProvider>
        <AuthProvider>
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
                  <Route path="/profile" element={<Profile />} />
                  <Route element={<RequireSignIn />}>
                    <Route element={<RequireConsent />}>
                      <Route path="/orders" element={<Orders />} />
                    </Route>
                  </Route>
                </Route>

                <Route element={<PlainLayout />}>
                  <Route path="/product/:itemId" element={<ProductDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/legal/:doc" element={<Legal />} />
                  <Route element={<RequireSignIn />}>
                    <Route element={<RequireConsent />}>
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/track/:orderId" element={<Tracking />} />
                    </Route>
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ConnectionGate>
          </ToastProvider>
        </CartProvider>
        </AuthProvider>
      </ProfileProvider>
    </StoreProvider>
  );
}
