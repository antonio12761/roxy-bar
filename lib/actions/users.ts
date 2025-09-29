"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { hashPassword } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface User {
  id: string;
  username: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
  attivo: boolean;
  bloccato: boolean;
  emailVerified: boolean | null;
  ultimoAccesso: Date | null;
  createdAt: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface UserWithStatus extends User {
  online: boolean;
  lastActivity: Date | null;
  currentTable: string | null;
}

export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'blocked' | 'inactive';
}

export async function getUtentiCamerieri() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Non autenticato" };
    }

    const camerieri = await prisma.user.findMany({
      where: {
        tenantId: currentUser.tenantId,
        ruolo: 'CAMERIERE'
      },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true
      },
      orderBy: [
        { cognome: 'asc' },
        { nome: 'asc' }
      ]
    });

    return {
      success: true,
      camerieri
    };
  } catch (error) {
    secureLog.error("Errore recupero camerieri:", error);
    return {
      success: false,
      error: "Errore nel recupero dei camerieri"
    };
  }
}

/**
 * Recupera la lista degli utenti con paginazione e filtri
 */
export async function getUsers(params: UsersListParams = {}) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantId: user.tenantId
    };

    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { nome: { contains: params.search, mode: 'insensitive' } },
        { cognome: { contains: params.search, mode: 'insensitive' } }
      ];
    }

    if (params.role) {
      where.ruolo = params.role;
    }

    if (params.status === 'active') {
      where.attivo = true;
      where.bloccato = false;
    } else if (params.status === 'blocked') {
      where.bloccato = true;
    } else if (params.status === 'inactive') {
      where.attivo = false;
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          nome: true,
          cognome: true,
          ruolo: true,
          attivo: true,
          bloccato: true,
          emailVerified: true,
          ultimoAccesso: true,
          createdAt: true,
          failedLoginAttempts: true,
          lockedUntil: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      success: true,
      data: {
        users: users as User[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    secureLog.error('Get users error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero degli utenti' 
    };
  }
}

/**
 * Recupera gli utenti con stato online (per supervisore)
 */
export async function getUsersWithOnlineStatus() {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Recupera tutti gli utenti con informazioni sullo stato online
    const users = await prisma.user.findMany({
      where: {
        attivo: true,
        tenantId: user.tenantId
      },
      include: {
        Session: {
          where: {
            expires: {
              gt: new Date() // Solo sessioni non scadute
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Determina lo stato online basandosi sulle sessioni attive
    const usersWithStatus: UserWithStatus[] = users.map(u => {
      const hasActiveSession = u.Session.length > 0;
      const lastSession = u.Session[0];
      
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        nome: u.nome,
        cognome: u.cognome,
        ruolo: u.ruolo,
        attivo: u.attivo,
        bloccato: u.bloccato || false,
        emailVerified: u.emailVerified,
        ultimoAccesso: u.ultimoAccesso,
        createdAt: u.createdAt,
        failedLoginAttempts: u.failedLoginAttempts,
        lockedUntil: u.lockedUntil,
        online: hasActiveSession,
        lastActivity: lastSession?.createdAt || u.ultimoAccesso,
        currentTable: null // Potrebbe essere implementato in futuro
      };
    });

    return {
      success: true,
      data: usersWithStatus
    };
  } catch (error) {
    secureLog.error('Get users with status error:', error);
    return { 
      success: false, 
      error: 'Errore nel recupero degli utenti' 
    };
  }
}

/**
 * Crea un nuovo utente
 */
export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  nome: string;
  cognome: string;
  ruolo: string;
  mustChangePassword?: boolean;
}) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Validazione
    if (!data.username || !data.email || !data.password || !data.nome || !data.cognome || !data.ruolo) {
      const missingFields = [];
      if (!data.username) missingFields.push('username');
      if (!data.email) missingFields.push('email');
      if (!data.password) missingFields.push('password');
      if (!data.nome) missingFields.push('nome');
      if (!data.cognome) missingFields.push('cognome');
      if (!data.ruolo) missingFields.push('ruolo');
      
      return {
        success: false,
        error: `Campi mancanti: ${missingFields.join(', ')}`
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Formato email non valido'
      };
    }

    // Validate password length
    if (data.password.length < 6) {
      return {
        success: false,
        error: 'La password deve essere almeno 6 caratteri'
      };
    }

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'SUPERVISORE', 'CAMERIERE', 'PREPARA', 'BANCO', 'CUCINA', 'CASSA'];
    if (!validRoles.includes(data.ruolo)) {
      return {
        success: false,
        error: `Ruolo non valido. Ruoli validi: ${validRoles.join(', ')}`
      };
    }

    // Check username unique
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username }
    });

    if (existingUsername) {
      return {
        success: false,
        error: 'Username già in uso'
      };
    }

    // Check email unique per tenant
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: data.email,
        tenantId: user.tenantId
      }
    });

    if (existingEmail) {
      return {
        success: false,
        error: 'Email già registrata in questa organizzazione'
      };
    }

    // Check tenant limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        _count: {
          select: { User: true }
        }
      }
    });

    if (tenant && tenant._count.User >= tenant.maxUsers) {
      return {
        success: false,
        error: `Limite utenti raggiunto (${tenant.maxUsers})`
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username: data.username,
        email: data.email,
        password: hashedPassword,
        nome: data.nome,
        cognome: data.cognome,
        ruolo: data.ruolo,
        tenantId: user.tenantId,
        mustChangePassword: data.mustChangePassword !== false,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true,
        createdAt: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        action: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        newValues: newUser
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/supervisore/users');

    return {
      success: true,
      data: newUser
    };
  } catch (error) {
    secureLog.error('Create user error:', error);
    
    // Check for specific errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: 'Username o email già esistenti'
        };
      }
    }
    
    return { 
      success: false, 
      error: 'Errore nella creazione dell\'utente' 
    };
  }
}

/**
 * Aggiorna un utente esistente
 */
export async function updateUser(
  userId: string,
  data: Partial<{
    username: string;
    email: string;
    password: string;
    nome: string;
    cognome: string;
    ruolo: string;
    attivo: boolean;
    bloccato: boolean;
    mustChangePassword: boolean;
  }>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Get existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!existingUser) {
      return {
        success: false,
        error: 'Utente non trovato'
      };
    }

    // Prevent modifying super admin unless you are super admin
    if (existingUser.ruolo === 'ADMIN' && user.ruolo !== 'ADMIN') {
      return {
        success: false,
        error: 'Non puoi modificare un super admin'
      };
    }

    // If updating username, check uniqueness
    if (data.username && data.username !== existingUser.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: data.username }
      });

      if (existingUsername) {
        return {
          success: false,
          error: 'Username già in uso'
        };
      }
    }

    // Prepare update data
    const updateData: any = { ...data };

    // If updating password, hash it
    if (data.password) {
      updateData.password = await hashPassword(data.password);
      updateData.passwordChangedAt = new Date();
      updateData.mustChangePassword = false;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true,
        bloccato: true,
        ultimoAccesso: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        oldValues: existingUser,
        newValues: updatedUser
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/supervisore/users');

    return {
      success: true,
      data: updatedUser
    };
  } catch (error) {
    secureLog.error('Update user error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'aggiornamento dell\'utente' 
    };
  }
}

/**
 * Elimina (disattiva) un utente
 */
export async function deleteUser(userId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Check user exists in tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!existingUser) {
      return {
        success: false,
        error: 'Utente non trovato'
      };
    }

    // Prevent deleting yourself
    if (userId === user.id) {
      return {
        success: false,
        error: 'Non puoi eliminare il tuo account'
      };
    }

    // Prevent deleting super admin
    if (existingUser.ruolo === 'ADMIN') {
      return {
        success: false,
        error: 'Non puoi eliminare un super admin'
      };
    }

    // Soft delete (set inactive)
    await prisma.user.update({
      where: { id: userId },
      data: { attivo: false }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        action: 'DELETE',
        entityType: 'USER',
        entityId: userId,
        oldValues: existingUser,
        tenantId: user.tenantId
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/supervisore/users');

    return {
      success: true,
      message: 'Utente disattivato con successo'
    };
  } catch (error) {
    secureLog.error('Delete user error:', error);
    return { 
      success: false, 
      error: 'Errore nell\'eliminazione dell\'utente' 
    };
  }
}

/**
 * Sblocca un utente bloccato
 */
export async function unlockUser(userId: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        bloccato: false,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    // Revalidate pages
    revalidatePath('/admin/users');
    revalidatePath('/supervisore/users');

    return {
      success: true,
      message: 'Utente sbloccato con successo'
    };
  } catch (error) {
    secureLog.error('Unlock user error:', error);
    return { 
      success: false, 
      error: 'Errore nello sblocco dell\'utente' 
    };
  }
}

/**
 * Reset password utente
 */
export async function resetUserPassword(userId: string, newPassword: string) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Validate password length
    if (newPassword.length < 6) {
      return {
        success: false,
        error: 'La password deve essere almeno 6 caratteri'
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        action: 'PASSWORD_RESET',
        entityType: 'USER',
        entityId: userId
      }
    });

    return {
      success: true,
      message: 'Password resettata con successo. L\'utente dovrà cambiarla al prossimo accesso.'
    };
  } catch (error) {
    secureLog.error('Reset password error:', error);
    return { 
      success: false, 
      error: 'Errore nel reset della password' 
    };
  }
}