import { prisma } from '../db';
import { nanoid } from 'nanoid';

export interface PermissionCheck {
  userId: string;
  permission: string;
  tenantId?: string;
}

export class PermissionService {
  /**
   * Verifica se un utente ha un permesso specifico
   */
  static async hasPermission({ userId, permission, tenantId }: PermissionCheck): Promise<boolean> {
    try {
      // 1. Verifica i ruoli di sistema dell'utente
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          ruolo: true, 
          attivo: true, 
          bloccato: true,
          tenantId: true 
        }
      });
      
      if (!user || !user.attivo || user.bloccato) {
        return false;
      }
      
      // Se tenantId è fornito, verifica che l'utente appartenga al tenant
      if (tenantId && user.tenantId !== tenantId) {
        return false;
      }
      
      // Admin ha sempre tutti i permessi
      if (user.ruolo === 'ADMIN') {
        return true;
      }
      
      // Mappa i ruoli di sistema ai permessi
      const systemRolePermissions = await this.getSystemRolePermissions(user.ruolo);
      if (systemRolePermissions.includes(permission)) {
        return true;
      }
      
      // 2. Verifica i ruoli personalizzati dell'utente
      const customRoles = await prisma.userCustomRole.findMany({
        where: {
          userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          CustomRole: {
            include: {
              RolePermission: {
                include: {
                  Permission: true
                }
              }
            }
          }
        }
      });
      
      // Controlla se uno dei ruoli personalizzati ha il permesso
      for (const userRole of customRoles) {
        if (!userRole.CustomRole.isActive) continue;
        
        const hasPermission = userRole.CustomRole.RolePermission.some(
          rp => rp.Permission.code === permission && rp.Permission.isActive
        );
        
        if (hasPermission) {
          return true;
        }
      }
      
      // 3. Verifica i permessi diretti dell'utente
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId,
          Permission: {
            code: permission,
            isActive: true
          },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });
      
      if (userPermission) {
        return userPermission.granted;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }
  
  /**
   * Ottiene tutti i permessi di un utente
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const permissions = new Set<string>();
      
      // 1. Permessi dal ruolo di sistema
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ruolo: true, attivo: true, bloccato: true }
      });
      
      if (!user || !user.attivo || user.bloccato) {
        return [];
      }
      
      // Admin ha tutti i permessi
      if (user.ruolo === 'ADMIN') {
        const allPermissions = await prisma.permission.findMany({
          where: { isActive: true },
          select: { code: true }
        });
        return allPermissions.map(p => p.code);
      }
      
      // Aggiungi permessi del ruolo di sistema
      const systemPermissions = await this.getSystemRolePermissions(user.ruolo);
      systemPermissions.forEach(p => permissions.add(p));
      
      // 2. Permessi dai ruoli personalizzati
      const customRoles = await prisma.userCustomRole.findMany({
        where: {
          userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          CustomRole: {
            include: {
              RolePermission: {
                include: {
                  Permission: true
                }
              }
            }
          }
        }
      });
      
      customRoles.forEach(userRole => {
        if (userRole.CustomRole.isActive) {
          userRole.CustomRole.RolePermission.forEach(rp => {
            if (rp.Permission.isActive) {
              permissions.add(rp.Permission.code);
            }
          });
        }
      });
      
      // 3. Permessi diretti dell'utente
      const directPermissions = await prisma.userPermission.findMany({
        where: {
          userId,
          Permission: { isActive: true },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          Permission: true
        }
      });
      
      directPermissions.forEach(up => {
        if (up.granted) {
          permissions.add(up.Permission.code);
        } else {
          permissions.delete(up.Permission.code);
        }
      });
      
      return Array.from(permissions);
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }
  
  /**
   * Mappa i ruoli di sistema ai permessi predefiniti
   */
  private static async getSystemRolePermissions(role: string): Promise<string[]> {
    const rolePermissionMap: Record<string, string[]> = {
      ADMIN: [], // Admin ha tutti i permessi per default
      MANAGER: [
        'users.view', 'orders.view', 'orders.manage_all',
        'payments.view', 'products.view', 'tables.view',
        'dashboard.view', 'statistics.view', 'reports.view',
        'page.dashboard', 'page.supervisore'
      ],
      SUPERVISORE: [
        'users.view', 'orders.view', 'orders.manage_all',
        'payments.view', 'tables.view', 'tables.manage',
        'page.supervisore', 'statistics.view'
      ],
      CAMERIERE: [
        'orders.view', 'orders.create', 'orders.edit',
        'tables.view', 'page.cameriere'
      ],
      PREPARA: [
        'orders.view', 'page.prepara'
      ],
      BANCO: [
        'orders.view', 'page.banco'
      ],
      CUCINA: [
        'orders.view', 'page.cucina'
      ],
      CASSA: [
        'payments.view', 'payments.create',
        'orders.view', 'page.cassa'
      ]
    };
    
    return rolePermissionMap[role] || [];
  }
  
  /**
   * Assegna un ruolo personalizzato a un utente
   */
  static async assignCustomRole(
    userId: string, 
    customRoleId: string, 
    assignedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.userCustomRole.create({
      data: {
        id: nanoid(),
        userId,
        customRoleId,
        assignedBy,
        expiresAt
      }
    });
  }
  
  /**
   * Rimuove un ruolo personalizzato da un utente
   */
  static async removeCustomRole(userId: string, customRoleId: string): Promise<void> {
    await prisma.userCustomRole.delete({
      where: {
        userId_customRoleId: {
          userId,
          customRoleId
        }
      }
    });
  }
  
  /**
   * Concede o nega un permesso specifico a un utente
   */
  static async setUserPermission(
    userId: string,
    permissionId: string,
    granted: boolean,
    grantedBy: string,
    reason?: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId
        }
      },
      update: {
        granted,
        grantedBy,
        grantedAt: new Date(),
        reason,
        expiresAt
      },
      create: {
        id: nanoid(),
        userId,
        permissionId,
        granted,
        grantedBy,
        reason,
        expiresAt
      }
    });
  }
}