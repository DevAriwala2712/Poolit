import { api } from "@poolit/domain";
import { useEffect, useState } from "react";

/** Whether the signed-in user is on the Poolit team. False until known, and on the old backend. */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    api
      .isAdmin()
      .then((v) => live && setAdmin(v === true))
      .catch(() => live && setAdmin(false));
    return () => {
      live = false;
    };
  }, []);
  return admin;
}
