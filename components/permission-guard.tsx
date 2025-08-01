"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";

interface PermissionGuardProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function PermissionGuard({
  permission,
  children,
  fallback,
  redirectTo = "/",
}: PermissionGuardProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkPermissions();
  }, [permission]);

  const checkPermissions = async () => {
    try {
      const permissions = Array.isArray(permission) ? permission : [permission];
      
      // Verifica tutti i permessi
      const checks = await Promise.all(
        permissions.map(async (perm) => {
          const response = await fetch(`/api/auth/check-permission?permission=${perm}`);
          if (response.ok) {
            const data = await response.json();
            return data.hasPermission;
          }
          return false;
        })
      );

      // L'utente ha almeno uno dei permessi richiesti
      const authorized = checks.some(check => check === true);
      setHasPermission(authorized);

      if (!authorized && redirectTo) {
        router.push(redirectTo);
      }
    } catch (error) {
      console.error("Errore verifica permessi:", error);
      setHasPermission(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <ShieldOff className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Accesso Negato</h2>
        <p className="text-gray-400 max-w-md">
          Non hai i permessi necessari per accedere a questa sezione.
          Contatta un amministratore se ritieni che questo sia un errore.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook per verificare i permessi nei componenti
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await fetch("/api/auth/permissions");
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error("Errore caricamento permessi:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string | string[]): boolean => {
    if (loading) return false;
    
    const perms = Array.isArray(permission) ? permission : [permission];
    return perms.some(p => permissions.includes(p));
  };

  return { permissions, hasPermission, loading };
}