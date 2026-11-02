import type { Page, Route } from "@playwright/test";

const CORS = {
  "access-control-allow-origin": "http://localhost:5174",
  "access-control-allow-headers": "authorization,content-type,idempotency-key,x-request-id",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};

export interface MockState {
  stock: number;
  slotStatus: "open" | "closed" | "dispatched";
  orderStatus: "placed" | "pooled" | "dispatched" | "delivered";
  calls: { method: string; path: string; headers: Record<string, string>; body?: unknown }[];
  failNextRestock: boolean;
}

const IDS = { hostel: "h1", vendor: "v1", slot: "s1", item: "i1", order: "o1" };

function overview(s: MockState) {
  const now = Date.now();
  return {
    days: 7,
    hostels: [{ id: IDS.hostel, name: "Tagore Hostel", blocks: ["Block A"] }],
    vendors: [
      {
        id: IDS.vendor,
        name: "Campus Mart",
        hostelId: IDS.hostel,
        prepMinutes: 6,
        acceptingOrders: true,
        poolWindowMinutes: 10,
        menu: [
          {
            id: IDS.item, vendorId: IDS.vendor, name: "Colgate Strong Teeth", category: "Essentials", price: 53,
            unit: "100 g", rating: 4.2, ratingCount: 0, isVeg: true, art: "📦", tint: "#F1EDE6",
            stockQty: s.stock, lowStockThreshold: 5, barcode: "8901314010193",
          },
        ],
      },
    ],
    slots: [{ id: IDS.slot, hostelId: IDS.hostel, vendorId: IDS.vendor, status: s.slotStatus, opensAt: now - 60_000, closesAt: now + 9 * 60_000 }],
    orders: [
      {
        id: IDS.order, slotId: IDS.slot, studentName: "Asha", block: "Block A", room: "204", tip: 0,
        items: [{ menuItemId: IDS.item, qty: 2, name: "Colgate Strong Teeth", unitPricePaise: 5300 }],
        subtotalPaise: 10600, status: s.orderStatus, createdAt: now - 120_000,
      },
    ],
  };
}

/** Stateful stand-in for the Poolit API and Supabase Auth. */
export async function mockBackend(page: Page): Promise<MockState> {
  const state: MockState = { stock: 3, slotStatus: "open", orderStatus: "placed", calls: [], failNextRestock: false };
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });

  await page.route("http://supabase.test/**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-origin": "*" } });
    const headers = { "access-control-allow-origin": "*" };
    if (url.pathname.endsWith("/token")) {
      const user = { id: "u1", aud: "authenticated", email: "owner@shop.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
      return route.fulfill({
        status: 200, contentType: "application/json", headers,
        body: JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers, body: "{}" });
  });

  await page.route("http://api.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const path = url.pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    state.calls.push({ method: req.method(), path, headers: req.headers(), body });

    if (path === "/vendor/overview") return json(route, 200, overview(state));
    if (path === `/menu-items/${IDS.item}/restock` && req.method() === "POST") {
      if (state.failNextRestock) {
        state.failNextRestock = false;
        return json(route, 503, { code: "service_unavailable", message: "Database is busy, try again" });
      }
      state.stock += body.amount;
      return json(route, 200, { message: "Restocked successfully", item: { id: IDS.item, stockQty: state.stock }, restockLog: { id: "r1", amount: body.amount } });
    }
    if (path === `/slots/${IDS.slot}/close`) {
      state.slotStatus = "closed"; state.orderStatus = "pooled";
      return json(route, 200, { slot: { id: IDS.slot, status: "closed" } });
    }
    if (path === `/slots/${IDS.slot}/dispatch`) {
      state.slotStatus = "dispatched"; state.orderStatus = "dispatched";
      return json(route, 200, { slot: { id: IDS.slot, status: "dispatched" } });
    }
    if (path === `/orders/${IDS.order}/deliver`) {
      state.orderStatus = "delivered";
      return json(route, 200, { order: { id: IDS.order, status: "delivered" } });
    }
    return json(route, 404, { message: "not mocked", path });
  });

  return state;
}

export async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("owner@shop.test");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
}
