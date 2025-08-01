"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export function AuthGuard({ children, allowedRoles, redirectTo = "/login" }: AuthGuardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getUser();
        
        if (!user) {
          router.push(redirectTo);
          return;
        }

        if (!allowedRoles.includes(user.ruolo)) {
          // User doesn't have the required role
          toast.error("Non hai i permessi per accedere a questa pagina");
          router.push("/");
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push(redirectTo);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [allowedRoles, redirectTo, router]);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.bg.main }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 
            className="h-8 w-8 animate-spin" 
            style={{ color: colors.text.primary }}
          />
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Caricamento...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}