import { useCallback, useEffect, useState } from "react";
import { api, clearPassword, getPassword, setPassword } from "../api";

/**
 * Admin session state. The password lives in localStorage (see api/client.ts);
 * this hook verifies it against the server and exposes login/logout.
 */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Remember admin session if a password is already stored and valid.
    if (getPassword()) {
      api
        .verifyAdmin()
        .then(() => setIsAdmin(true))
        .catch(() => clearPassword());
    }
  }, []);

  const login = useCallback(async (pw: string) => {
    setPassword(pw);
    try {
      await api.verifyAdmin();
      setIsAdmin(true);
    } catch (e) {
      clearPassword();
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    clearPassword();
    setIsAdmin(false);
  }, []);

  return { isAdmin, login, logout };
}
