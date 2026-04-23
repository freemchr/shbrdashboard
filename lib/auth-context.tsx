'use client';

import { createContext, useContext } from 'react';

export interface AuthContext {
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  hiddenPaths: Set<string>;
}

const AuthCtx = createContext<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
});

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContext;
  children: React.ReactNode;
}) {
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
