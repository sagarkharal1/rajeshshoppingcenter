import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const ADMIN_TOKEN_KEY = "rajesh_admin_token";

type AdminContextType = {
  isLoggedIn: boolean;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ADMIN_TOKEN_KEY).then((t) => {
      if (t) setToken(t);
    });
  }, []);

  const login = useCallback(async (newToken: string) => {
    await AsyncStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  }, []);

  return (
    <AdminContext.Provider
      value={{ isLoggedIn: !!token, token, login, logout }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
