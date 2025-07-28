"use client";

import { useEffect, useState } from "react";

/**
 * Hook to get the current auth token from cookies
 * This is needed for authenticated SSE connections
 */
export function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get token from cookie on client side
    const getTokenFromCookie = () => {
      const cookieName = "bar-roxy-session"; // Must match the server-side COOKIE_NAME
      const cookies = document.cookie.split('; ');
      
      for (const cookie of cookies) {
        const [name, value] = cookie.split('=');
        if (name === cookieName) {
          console.log("🔑 Token found:", value.substring(0, 20) + "...");
          setToken(value);
          setIsLoading(false);
          return;
        }
      }
      
      console.log("❌ No token found in cookies. Available cookies:", document.cookie);
      setToken(null);
      setIsLoading(false);
    };

    getTokenFromCookie();

    // Listen for storage events to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-token') {
        setToken(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return { token, isLoading };
}