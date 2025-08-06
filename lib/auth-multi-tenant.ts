import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { sseService } from "./sse/sse-service";
import crypto from "crypto";
import { nanoid } from "nanoid";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be defined and at least 32 characters long");
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "bar-roxy-session";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minuti

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
  requiresPasswordChange?: boolean;
  redirectPath?: string;
}

export interface RegisterAdminData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 12);
}

// Verify password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await compare(password, hashedPassword);
}

// Generate JWT token with tenant info
export function generateToken(userId: string, tenantId: string): string {
  return sign({ userId, tenantId }, JWT_SECRET!, { expiresIn: "7d" });
}

// Verify JWT token
export function verifyToken(token: string): { userId: string; tenantId: string } | null {
  try {
    const decoded = verify(token, JWT_SECRET!) as { userId: string; tenantId: string };
    return decoded;
  } catch {
    return null;
  }
}

// Check if user is locked
async function isUserLocked(user: any): Promise<boolean> {
  if (!user.lockedUntil) return false;
  
  if (new Date() > user.lockedUntil) {
    // Unlock user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedUntil: null,
        failedLoginAttempts: 0
      }
    });
    return false;
  }
  
  return true;
}

// Login with username and password
export async function loginUser(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    // Find user by username (username è unico globalmente)
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        Tenant: true
      }
    });

    if (!user) {
      return { success: false, error: "Credenziali non valide" };
    }

    // Check if user is active
    if (!user.attivo) {
      return { success: false, error: "Account non attivo" };
    }

    // Check if tenant is active
    if (!user.Tenant.isActive) {
      return { success: false, error: "Organizzazione non attiva" };
    }

    // Check if user is locked
    if (await isUserLocked(user)) {
      return { success: false, error: "Account temporaneamente bloccato per troppi tentativi falliti" };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      // Increment failed attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: any = { failedLoginAttempts: failedAttempts };

      // Lock user if max attempts reached
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_TIME);
        updateData.failedLoginAttempts = 0;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });

      return { success: false, error: "Credenziali non valide" };
    }

    // Reset failed attempts and update last access
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        ultimoAccesso: new Date()
      }
    });

    // Generate token
    const token = generateToken(user.id, user.tenantId);

    // Create session
    await prisma.session.create({
      data: {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        tenantId: user.tenantId,
        token,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 giorni
      }
    });

    // Set cookie
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 giorni
      path: "/"
    });
    
    console.log(`[AUTH] Cookie set: ${COOKIE_NAME}, secure: ${isProduction}, path: /`);

    // Emit SSE event
    sseService.emit('user:presence', {
      userId: user.id,
      status: 'online',
      lastActivity: new Date().toISOString()
    }, {
      tenantId: user.tenantId
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: user.tenantId,
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id
      }
    });

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      nome: user.nome,
      cognome: user.cognome,
      ruolo: user.ruolo,
      tenantId: user.tenantId,
      tenantName: user.Tenant.name,
      tenantSlug: user.Tenant.slug
    };

    return {
      success: true,
      user: authUser,
      token,
      requiresPasswordChange: user.mustChangePassword || undefined
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Errore durante il login" };
  }
}

// Get current user from session
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME);

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token.value);
    if (!decoded) {
      return null;
    }

    // Verify session exists and is valid
    const session = await prisma.session.findUnique({
      where: { token: token.value }
    });

    if (!session || session.expires < new Date()) {
      return null;
    }

    // Get user with tenant info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        Tenant: true
      }
    });

    if (!user || !user.attivo || user.tenantId !== decoded.tenantId) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nome: user.nome,
      cognome: user.cognome,
      ruolo: user.ruolo,
      tenantId: user.tenantId,
      tenantName: user.Tenant.name,
      tenantSlug: user.Tenant.slug
    };
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}

// Register new admin and tenant
export async function registerAdmin(data: RegisterAdminData): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Check if email already exists
    const existingEmail = await prisma.user.findFirst({
      where: { email: data.email }
    });

    if (existingEmail) {
      return { success: false, error: "Email già registrata" };
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username }
    });

    if (existingUsername) {
      return { success: false, error: "Username già in uso" };
    }

    // Check if tenant slug already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: data.tenantSlug }
    });

    if (existingTenant) {
      return { success: false, error: "Nome organizzazione già in uso" };
    }

    // Create registration token
    const registrationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore

    // Save registration request
    await prisma.adminRegistration.create({
      data: {
        id: nanoid(),
        email: data.email,
        token: registrationToken,
        tokenExpiry,
        tenantName: data.tenantName,
        tenantSlug: data.tenantSlug,
        adminUsername: data.username,
        adminFirstName: data.firstName,
        adminLastName: data.lastName,
        updatedAt: new Date()
      }
    });

    // TODO: Send confirmation email with token
    // For now, we'll complete registration immediately
    const result = await completeAdminRegistration(registrationToken, data.password);
    
    return result;
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Errore durante la registrazione" };
  }
}

// Complete admin registration
export async function completeAdminRegistration(
  token: string,
  password: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Find registration by token
    const registration = await prisma.adminRegistration.findUnique({
      where: { token }
    });

    if (!registration) {
      return { success: false, error: "Token non valido" };
    }

    if (registration.status !== 'PENDING') {
      return { success: false, error: "Registrazione già completata" };
    }

    if (registration.tokenExpiry < new Date()) {
      await prisma.adminRegistration.update({
        where: { id: registration.id },
        data: { status: 'EXPIRED' }
      });
      return { success: false, error: "Token scaduto" };
    }

    // Create tenant and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          id: nanoid(),
          name: registration.tenantName,
          slug: registration.tenantSlug,
          plan: 'BASIC',
          updatedAt: new Date()
        }
      });

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          id: nanoid(),
          username: registration.adminUsername,
          email: registration.email,
          password: hashedPassword,
          nome: registration.adminFirstName,
          cognome: registration.adminLastName,
          ruolo: 'ADMIN',
          tenantId: tenant.id,
          emailVerified: new Date(),
          updatedAt: new Date()
        }
      });

      // Update registration status
      await tx.adminRegistration.update({
        where: { id: registration.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      return { tenant, adminUser };
    });

    return {
      success: true,
      message: "Registrazione completata con successo"
    };
  } catch (error) {
    console.error("Complete registration error:", error);
    return { success: false, error: "Errore durante il completamento della registrazione" };
  }
}

// Logout
export async function logout(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME);

    if (token) {
      // Find session to get user info
      const session = await prisma.session.findUnique({
        where: { token: token.value },
        include: { User: true }
      });

      // Delete session
      await prisma.session.delete({
        where: { token: token.value }
      });

      // Emit SSE event
      if (session) {
        sseService.emit('user:presence', {
          userId: session.User.id,
          status: 'offline',
          lastActivity: new Date().toISOString()
        }, {
          tenantId: session.tenantId
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tenantId: session.tenantId,
            userId: session.User.id,
            action: 'LOGOUT',
            entityType: 'USER',
            entityId: session.User.id
          }
        });
      }
    }

    // Delete cookie
    cookieStore.delete(COOKIE_NAME);

    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false };
  }
}

// Check if user has permission
export function hasPermission(user: AuthUser, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    SUPER_ADMIN: ['*'], // All permissions
    ADMIN: ['manage_users', 'manage_settings', 'view_reports', 'manage_products', 'manage_orders'],
    MANAGER: ['manage_products', 'manage_orders', 'view_reports'],
    SUPERVISORE: ['manage_orders', 'view_reports', 'manage_shifts'],
    CAMERIERE: ['create_orders', 'view_orders'],
    PREPARA: ['manage_preparations', 'view_orders'],
    BANCO: ['manage_preparations', 'view_orders'],
    CUCINA: ['manage_kitchen', 'view_orders'],
    CASSA: ['manage_payments', 'view_orders', 'view_reports']
  };

  const userPermissions = permissions[user.ruolo] || [];
  return userPermissions.includes('*') || userPermissions.includes(permission);
}

// Middleware per verificare autenticazione e tenant
export async function requireAuth(
  requiredPermission?: string
): Promise<{ 
  user: AuthUser | null; 
  error?: string 
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { user: null, error: "Non autenticato" };
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return { user: null, error: "Permessi insufficienti" };
  }

  return { user };
}