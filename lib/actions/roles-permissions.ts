"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";
import { PermissionService } from "@/lib/services/permission-service";

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  isActive: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  RolePermission?: Array<{
    Permission: Permission;
  }>;
  UserCustomRole?: Array<{
    User: {
      id: string;
      nome: string;
      cognome: string;
      email: string;
    };
  }>;
  _count?: {
    UserCustomRole: number;
  };
}

export interface RoleWithPermissions extends CustomRole {
  permissions: Permission[];
}

/**
 * Recupera tutti i ruoli personalizzati del tenant
 */
export async function getRoles() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.view'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    const roles = await prisma.customRole.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      include: {
        RolePermission: {
          include: {
            Permission: true
          }
        },
        UserCustomRole: {
          include: {
            User: {
              select: {
                id: true,
                nome: true,
                cognome: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            UserCustomRole: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return {
      success: true,
      data: roles as CustomRole[]
    };
  } catch (error) {
    secureLog.error('Get roles error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dei ruoli' 
    };
  }
}

/**
 * Crea un nuovo ruolo personalizzato
 */
export async function createRole(data: {
  name: string;
  description?: string;
  permissions?: string[];
}) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.create'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    if (!data.name) {
      return {
        success: false,
        error: "Nome ruolo richiesto"
      };
    }

    // Crea il ruolo
    const role = await prisma.customRole.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        tenantId: user.tenantId!,
        updatedAt: new Date()
      }
    });

    // Assegna i permessi al ruolo
    if (data.permissions && Array.isArray(data.permissions)) {
      for (const permissionId of data.permissions) {
        await prisma.rolePermission.create({
          data: {
            id: crypto.randomUUID(),
            roleId: role.id,
            permissionId
          }
        });
      }
    }

    // Recupera il ruolo con i permessi
    const roleWithPermissions = await prisma.customRole.findUnique({
      where: { id: role.id },
      include: {
        RolePermission: {
          include: {
            Permission: true
          }
        }
      }
    });

    // Revalidate pages
    revalidatePath('/admin/roles');
    revalidatePath('/admin/permissions');

    return {
      success: true,
      data: roleWithPermissions as CustomRole
    };
  } catch (error) {
    secureLog.error('Create role error:', error);
    return { 
      success: false, 
      error: 'Errore nella creazione del ruolo' 
    };
  }
}

/**
 * Aggiorna un ruolo personalizzato
 */
export async function updateRole(
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.edit'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Verifica che il ruolo appartenga al tenant
    const existingRole = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        tenantId: user.tenantId
      }
    });

    if (!existingRole) {
      return {
        success: false,
        error: "Ruolo non trovato"
      };
    }

    // Non permettere la modifica di ruoli di sistema
    if (existingRole.isSystem) {
      return {
        success: false,
        error: "Non è possibile modificare ruoli di sistema"
      };
    }

    // Aggiorna il ruolo
    const updatedRole = await prisma.customRole.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        updatedAt: new Date()
      }
    });

    // Aggiorna i permessi se forniti
    if (data.permissions !== undefined) {
      // Rimuovi tutti i permessi esistenti
      await prisma.rolePermission.deleteMany({
        where: { roleId }
      });

      // Aggiungi i nuovi permessi
      if (Array.isArray(data.permissions)) {
        for (const permissionId of data.permissions) {
          await prisma.rolePermission.create({
            data: {
              id: crypto.randomUUID(),
              roleId,
              permissionId
            }
          });
        }
      }
    }

    // Recupera il ruolo aggiornato con i permessi
    const roleWithPermissions = await prisma.customRole.findUnique({
      where: { id: roleId },
      include: {
        RolePermission: {
          include: {
            Permission: true
          }
        }
      }
    });

    // Revalidate pages
    revalidatePath('/admin/roles');
    revalidatePath('/admin/permissions');

    return {
      success: true,
      data: roleWithPermissions as CustomRole
    };
  } catch (error) {
    secureLog.error('Update role error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento del ruolo' 
    };
  }
}

/**
 * Elimina un ruolo personalizzato
 */
export async function deleteRole(roleId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.delete'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Verifica che il ruolo appartenga al tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        tenantId: user.tenantId
      }
    });

    if (!role) {
      return {
        success: false,
        error: "Ruolo non trovato"
      };
    }

    // Non permettere l'eliminazione di ruoli di sistema
    if (role.isSystem) {
      return {
        success: false,
        error: "Non è possibile eliminare ruoli di sistema"
      };
    }

    // Elimina il ruolo (le relazioni vengono eliminate automaticamente con CASCADE)
    await prisma.customRole.delete({
      where: { id: roleId }
    });

    // Revalidate pages
    revalidatePath('/admin/roles');
    revalidatePath('/admin/permissions');

    return {
      success: true,
      message: 'Ruolo eliminato con successo'
    };
  } catch (error) {
    secureLog.error('Delete role error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'eliminazione del ruolo' 
    };
  }
}

/**
 * Recupera tutti i permessi disponibili
 */
export async function getPermissions() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.view'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    const permissions = await prisma.permission.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' }
      ]
    });

    // Raggruppa i permessi per risorsa
    const groupedPermissions = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return {
      success: true,
      data: {
        permissions: permissions as Permission[],
        groupedPermissions
      }
    };
  } catch (error) {
    secureLog.error('Get permissions error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dei permessi' 
    };
  }
}

/**
 * Recupera i permessi di un utente specifico
 */
export async function getUserPermissions(userId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'users.view'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Verifica che l'utente appartenga allo stesso tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!targetUser) {
      return {
        success: false,
        error: "Utente non trovato"
      };
    }

    // Ottieni tutti i permessi dell'utente
    const permissions = await PermissionService.getUserPermissions(userId);

    // Ottieni i ruoli personalizzati dell'utente
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
        },
        User_assignedBy: {
          select: {
            id: true,
            nome: true,
            cognome: true
          }
        }
      }
    });

    // Ottieni i permessi diretti dell'utente
    const directPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        Permission: true,
        User_grantedBy: {
          select: {
            id: true,
            nome: true,
            cognome: true
          }
        }
      }
    });

    return {
      success: true,
      data: {
        permissions,
        customRoles,
        directPermissions,
        systemRole: targetUser.ruolo
      }
    };
  } catch (error) {
    secureLog.error('Get user permissions error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero dei permessi utente' 
    };
  }
}

/**
 * Assegna un ruolo personalizzato a un utente
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  expiresAt?: Date
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'users.manage_roles'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Verifica che l'utente e il ruolo appartengano al tenant
    const [targetUser, role] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: userId,
          tenantId: user.tenantId
        }
      }),
      prisma.customRole.findFirst({
        where: {
          id: roleId,
          tenantId: user.tenantId,
          isActive: true
        }
      })
    ]);

    if (!targetUser || !role) {
      return {
        success: false,
        error: "Utente o ruolo non trovato"
      };
    }

    // Verifica se l'utente ha già questo ruolo
    const existingAssignment = await prisma.userCustomRole.findFirst({
      where: {
        userId,
        roleId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (existingAssignment) {
      return {
        success: false,
        error: "L'utente ha già questo ruolo"
      };
    }

    // Assegna il ruolo
    await prisma.userCustomRole.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        roleId,
        assignedById: user.id,
        expiresAt
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/admin/roles');

    return {
      success: true,
      message: 'Ruolo assegnato con successo'
    };
  } catch (error) {
    secureLog.error('Assign role to user error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'assegnazione del ruolo' 
    };
  }
}

/**
 * Rimuove un ruolo personalizzato da un utente
 */
export async function removeRoleFromUser(userId: string, roleId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'users.manage_roles'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Rimuovi il ruolo
    await prisma.userCustomRole.deleteMany({
      where: {
        userId,
        roleId
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/admin/roles');

    return {
      success: true,
      message: 'Ruolo rimosso con successo'
    };
  } catch (error) {
    secureLog.error('Remove role from user error:', error);
    return { 
      success: false, 
      error: 'Errore nella rimozione del ruolo' 
    };
  }
}

/**
 * Assegna un permesso diretto a un utente
 */
export async function grantPermissionToUser(
  userId: string,
  permissionId: string,
  expiresAt?: Date
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'users.manage_permissions'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Verifica che l'utente appartenga al tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!targetUser) {
      return {
        success: false,
        error: "Utente non trovato"
      };
    }

    // Verifica se l'utente ha già questo permesso
    const existingPermission = await prisma.userPermission.findFirst({
      where: {
        userId,
        permissionId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (existingPermission) {
      return {
        success: false,
        error: "L'utente ha già questo permesso"
      };
    }

    // Assegna il permesso
    await prisma.userPermission.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        permissionId,
        grantedById: user.id,
        expiresAt
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/admin/permissions');

    return {
      success: true,
      message: 'Permesso assegnato con successo'
    };
  } catch (error) {
    secureLog.error('Grant permission to user error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'assegnazione del permesso' 
    };
  }
}

/**
 * Revoca un permesso diretto da un utente
 */
export async function revokePermissionFromUser(
  userId: string,
  permissionId: string
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'users.manage_permissions'
    });

    if (!hasPermission) {
      return { 
        success: false, 
        error: "Permesso negato" 
      };
    }

    // Rimuovi il permesso
    await prisma.userPermission.deleteMany({
      where: {
        userId,
        permissionId
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/admin/permissions');

    return {
      success: true,
      message: 'Permesso revocato con successo'
    };
  } catch (error) {
    secureLog.error('Revoke permission from user error:', error);
    return { 
      success: false, 
      error: 'Errore nella revoca del permesso' 
    };
  }
}