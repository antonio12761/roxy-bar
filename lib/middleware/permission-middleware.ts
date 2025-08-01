import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { PermissionService } from '@/lib/services/permission-service';

/**
 * Middleware per verificare i permessi dell'utente
 */
export async function withPermission(
  permission: string | string[],
  handler: (req: Request, context?: any) => Promise<Response>
) {
  return async (req: Request, context?: any): Promise<Response> => {
    try {
      // Verifica autenticazione
      const user = await checkAuth();
      if (!user) {
        return NextResponse.json(
          { error: 'Non autorizzato' },
          { status: 401 }
        );
      }

      // Verifica permessi
      const permissions = Array.isArray(permission) ? permission : [permission];
      let hasPermission = false;

      for (const perm of permissions) {
        if (await PermissionService.hasPermission({
          userId: user.id,
          permission: perm,
          tenantId: user.tenantId
        })) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Permesso negato' },
          { status: 403 }
        );
      }

      // Esegui l'handler originale
      return handler(req, context);
    } catch (error) {
      console.error('Errore middleware permessi:', error);
      return NextResponse.json(
        { error: 'Errore interno del server' },
        { status: 500 }
      );
    }
  };
}

/**
 * Hook per verificare i permessi nei componenti client
 */
export function usePermission() {
  const checkPermission = async (permission: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/auth/check-permission?permission=${permission}`);
      if (response.ok) {
        const data = await response.json();
        return data.hasPermission;
      }
      return false;
    } catch (error) {
      console.error('Errore verifica permesso:', error);
      return false;
    }
  };

  return { checkPermission };
}