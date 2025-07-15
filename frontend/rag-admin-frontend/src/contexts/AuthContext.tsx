'use client'; // This context provider needs to be a client component

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isLoggedIn: boolean;
  userEmail: string | null;
  login: (token: string, userEmail: string) => void;
  logout: () => void;
  isLoadingAuth: boolean; // To indicate if auth status is being checked
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Initially true to check localStorage
  const router = useRouter();

  useEffect(() => {
    // On component mount, check localStorage for token
    const token = localStorage.getItem('token');
    const storedUserEmail = localStorage.getItem('userEmail'); // Assuming you store email too

    if (token && storedUserEmail) {
      // Basic check: In a real app, you'd want to validate the token (e.g., decode JWT, check expiry)
      setIsLoggedIn(true);
      setUserEmail(storedUserEmail);
    }
    setIsLoadingAuth(false);
  }, []);

  const login = (token: string, email: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email); // Store user email
    setIsLoggedIn(true);
    setUserEmail(email);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setIsLoggedIn(false);
    setUserEmail(null);
    router.push('/login'); // Redirect to login page after logout
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, userEmail, login, logout, isLoadingAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}