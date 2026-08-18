import { useEffect, useState } from "react";

export function useMyName() {
  const [name, setName] = useState(() => localStorage.getItem("poolit-my-name") ?? "");

  useEffect(() => {
    if (name) localStorage.setItem("poolit-my-name", name);
  }, [name]);

  return [name, setName] as const;
}

export function useMyOrderId(slotId: string) {
  const key = `poolit-my-order-${slotId}`;
  const [orderId, setOrderIdState] = useState(() => localStorage.getItem(key));

  const setOrderId = (id: string | null) => {
    setOrderIdState(id);
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  };

  return [orderId, setOrderId] as const;
}
