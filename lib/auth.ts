import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { sseService } from "./sse/sse-service";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be defined and at least 32 characters long");
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "bar-roxy-session";
const isProduction = process.env.NODE_ENV === "production";

export type Role =
  | "ADMIN"
  | "MANAGER"
  | "SUPERVISORE"
  | "CAMERIERE"
  | "PREPARA"
  | "BANCO"
  | "CUCINA"
  | "CASSA";

export interface User {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: Role;
  attivo: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  redirectPath?: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 12);
}

// Check auth for pages
export async function checkAuth(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME);
    
    if (!token) {
      return null;
    }

    const decoded = verify(token.value, JWT_SECRET!) as any;
    if (!decoded?.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true
      }
    });

    if (!user || !user.attivo) {
      return null;
    }

    return user as User;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

// Get current user (alias for checkAuth)
export async function getCurrentUser(): Promise<User | null> {
  return await checkAuth();
}

// Verifica password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await compare(password, hashedPassword);
}

// Genera JWT token
export function generateToken(userId: string): string {
  return sign({ userId }, JWT_SECRET!, { expiresIn: "7d" });
}

// Verifica JWT token
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = verify(token, JWT_SECRET!) as { userId: string };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// Login con solo password
export async function loginUser(password: string): Promise<AuthResult> {
  try {
    console.log(`[LOGIN] Tentativo login con password: ${password}`);
    // Cerca tutti gli utenti attivi
    const users = await prisma.user.findMany({
      where: {
        attivo: true
      },
      select: {
        id: true,
        email: true,
        password: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true,
        bloccato: true,
      },
    });
    console.log(`[LOGIN] Trovati ${users.length} utenti attivi:`, users.map(u => `${u.nome} (${u.ruolo})`));

    // Verifica la password contro tutti gli utenti
    let matchedUser = null;
    for (const user of users) {
      const isPasswordValid = await verifyPassword(password, user.password);
      console.log(`[LOGIN] Controllo password per ${user.nome}: ${isPasswordValid ? 'MATCH' : 'NO MATCH'}`);
      if (isPasswordValid) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      console.log(`[LOGIN] Nessun utente trovato con password fornita`);
      return { success: false, error: "Password non valida" };
    }

    console.log(`[LOGIN] Login riuscito per: ${matchedUser.nome} (${matchedUser.ruolo})`);

    // Controlla se l'utente è bloccato
    if (matchedUser.bloccato) {
      return { success: false, error: "Utente bloccato. Contatta il supervisore per essere riattivato." };
    }

    // Aggiorna ultimo accesso
    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { ultimoAccesso: new Date() },
    });

    // Emetti evento SSE per notificare il login
    sseService.emit('user:presence', {
      userId: matchedUser.id,
      status: 'online',
      lastActivity: new Date().toISOString()
    }, {
      channels: ['system', 'station:supervisor']
    });

    // Emetti anche una notifica per il supervisore
    sseService.emit('notification:new', {
      id: `login-${matchedUser.id}-${Date.now()}`,
      title: 'Nuovo accesso',
      message: `${matchedUser.nome} ${matchedUser.cognome} (${matchedUser.ruolo}) ha effettuato l'accesso`,
      priority: 'normal',
      targetRoles: ['SUPERVISORE']
    }, {
      channels: ['notifications', 'station:supervisor']
    });

    // Genera token e salva sessione
    const token = generateToken(matchedUser.id);
    const isDevelopment = process.env.NODE_ENV === "development";
    
    await prisma.session.create({
      data: {
        userId: matchedUser.id,
        token,
        expires: isDevelopment 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 giorni in sviluppo
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 giorni in produzione
      },
    });

    // Set cookie with development-friendly settings
    const cookieStore = await cookies();
    const isDev = process.env.NODE_ENV === "development";
    
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false, // Allow in development over HTTP
      sameSite: isDev ? "lax" : "strict",
      maxAge: isDev 
        ? 30 * 24 * 60 * 60 // 30 days in development
        : parseInt(process.env.SESSION_MAX_AGE || "86400"), // 1 day in production
      path: "/",
      domain: undefined, // Let browser handle domain
    });
    
    console.log(`[LOGIN] Cookie set with name: ${COOKIE_NAME}, maxAge: ${isDev ? '30 days' : '1 day'}`);

    const { password: _, ...userWithoutPassword } = matchedUser;
    return { success: true, user: userWithoutPassword };
  } catch (error) {
    console.error("Errore login:", error);
    return { success: false, error: "Errore interno del server" };
  }
}


// Server Action per logout (da usare nei componenti)
export async function logout() {
  "use server";
  
  try {
    const result = await logoutUser();
    if (result.success) {
      // Redirect after logout
      const { redirect } = await import('next/navigation');
      redirect('/login');
    }
    return result;
  } catch (error) {
    console.error("Errore logout action:", error);
    return { success: false };
  }
}

// Logout (funzione interna)
export async function logoutUser(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token) {
      // Trova l'utente dalla sessione prima di eliminarla
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      });

      await prisma.session.deleteMany({
        where: { token },
      });

      // Se troviamo l'utente, emettiamo l'evento di logout
      if (session?.user) {
        sseService.emit('user:presence', {
          userId: session.user.id,
          status: 'offline',
          lastActivity: new Date().toISOString()
        }, {
          channels: ['system', 'station:supervisor']
        });

        // Notifica al supervisore
        sseService.emit('notification:new', {
          id: `logout-${session.user.id}-${Date.now()}`,
          title: 'Disconnessione',
          message: `${session.user.nome} ${session.user.cognome} (${session.user.ruolo}) si è disconnesso`,
          priority: 'normal',
          targetRoles: ['SUPERVISORE']
        }, {
          channels: ['notifications', 'station:supervisor']
        });
      }
    }

    cookieStore.delete(COOKIE_NAME);
    return { success: true };
  } catch (error) {
    console.error("Errore logout:", error);
    return { success: false };
  }
}