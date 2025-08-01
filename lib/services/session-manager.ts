"use server";

import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { auditService } from "./audit-service";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export interface SessionData {
  id: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata: {
    loginMethod: string;
    deviceType: string;
    location?: string;
    warnings: number;
    lastWarning?: Date;
  };
}

export interface SessionConfig {
  maxSessions: number; // Massimo sessioni simultanee per utente
  inactivityTimeout: number; // Minuti di inattività prima del timeout
  absoluteTimeout: number; // Minuti massimi di durata sessione
  warningThreshold: number; // Minuti prima di avvisare per scadenza
  enableDeviceTracking: boolean;
  enableLocationTracking: boolean;
  forceLogoutOnNewDevice: boolean;
  sessionCookieName: string;
  sessionCookieMaxAge: number; // Secondi
  enableSecureCookies: boolean;
}

export class SessionManager {
  private config: SessionConfig = {
    maxSessions: 3, // Max 3 sessioni simultanee
    inactivityTimeout: 30, // 30 minuti di inattività
    absoluteTimeout: 480, // 8 ore massime
    warningThreshold: 5, // Avvisa 5 minuti prima
    enableDeviceTracking: true,
    enableLocationTracking: false,
    forceLogoutOnNewDevice: false,
    sessionCookieName: 'bar-roxy-session',
    sessionCookieMaxAge: 30 * 60, // 30 minuti
    enableSecureCookies: process.env.NODE_ENV === 'production'
  };

  private activeSessions = new Map<string, SessionData>();
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SessionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.startSessionCleanup();
  }

  // Crea nuova sessione
  async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    loginMethod: 'PASSWORD' | 'PIN' | 'BIOMETRIC' = 'PASSWORD'
  ): Promise<{
    sessionId: string;
    token: string;
    expiresAt: Date;
    warnings?: string[];
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, nome: true, ruolo: true, attivo: true }
      });

      if (!user || !user.attivo) {
        throw new Error('Utente non valido o disattivato');
      }

      console.log(`[Session] Creazione sessione per ${user.nome} (${userId})`);

      // Verifica limite sessioni
      const existingSessions = await this.getUserActiveSessions(userId);
      const warnings: string[] = [];

      if (existingSessions.length >= this.config.maxSessions) {
        if (this.config.forceLogoutOnNewDevice) {
          // Termina sessione più vecchia
          const oldestSession = existingSessions.sort((a, b) => 
            a.lastActivity.getTime() - b.lastActivity.getTime()
          )[0];
          
          await this.terminateSession(oldestSession.id, 'NEW_DEVICE_LOGIN');
          warnings.push('Sessione precedente terminata per nuovo accesso');
        } else {
          throw new Error(`Limite massimo di ${this.config.maxSessions} sessioni raggiunto`);
        }
      }

      // Genera ID sessione e token
      const sessionId = this.generateSessionId();
      const token = this.generateSessionToken();
      const deviceId = this.generateDeviceId(userAgent, ipAddress);
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.absoluteTimeout * 60 * 1000);

      // Crea sessione nel database
      await prisma.userSession.create({
        data: {
          id: sessionId,
          userId,
          token: this.hashToken(token),
          deviceId,
          ipAddress,
          userAgent,
          loginMethod,
          createdAt: now,
          lastActivity: now,
          expiresAt,
          isActive: true,
          metadata: JSON.stringify({
            loginMethod,
            deviceType: this.detectDeviceType(userAgent),
            warnings: 0
          })
        }
      });

      // Aggiungi alla cache locale
      const sessionData: SessionData = {
        id: sessionId,
        userId,
        deviceId,
        ipAddress,
        userAgent,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        isActive: true,
        metadata: {
          loginMethod,
          deviceType: this.detectDeviceType(userAgent),
          warnings: 0
        }
      };
      
      this.activeSessions.set(sessionId, sessionData);

      // Audit log
      await auditService.logSecurityEvent('LOGIN', userId, sessionId, {
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          loginMethod,
          deviceId,
          activeSessionsCount: existingSessions.length + 1
        }
      });

      // Imposta cookie
      this.setSessionCookie(sessionId, token);

      console.log(`[Session] Sessione ${sessionId} creata per ${user.nome}`);

      return {
        sessionId,
        token,
        expiresAt,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error('[Session] Errore creazione sessione:', error);
      throw error;
    }
  }

  // Valida sessione esistente
  async validateSession(sessionId?: string, token?: string): Promise<{
    valid: boolean;
    sessionData?: SessionData;
    user?: any;
    warnings?: string[];
    timeRemaining?: number;
  }> {
    try {
      // Ottieni sessione da cookie se non fornita
      if (!sessionId || !token) {
        const cookieData = await this.getSessionFromCookie();
        if (!cookieData) {
          return { valid: false };
        }
        sessionId = cookieData.sessionId;
        token = cookieData.token;
      }

      // Verifica cache locale prima
      let sessionData = this.activeSessions.get(sessionId!);
      
      if (!sessionData) {
        // Carica dal database
        const dbSession = await prisma.userSession.findUnique({
          where: { id: sessionId },
          include: {
            User: {
              select: {
                id: true,
                nome: true,
                ruolo: true,
                attivo: true
              }
            }
          }
        });

        if (!dbSession || !dbSession.isActive) {
          return { valid: false };
        }

        sessionData = {
          id: dbSession.id,
          userId: dbSession.userId,
          deviceId: dbSession.deviceId,
          ipAddress: dbSession.ipAddress,
          userAgent: dbSession.userAgent,
          createdAt: dbSession.createdAt,
          lastActivity: dbSession.lastActivity,
          expiresAt: dbSession.expiresAt,
          isActive: dbSession.isActive,
          metadata: dbSession.metadata ? JSON.parse(dbSession.metadata as string) : {}
        };

        this.activeSessions.set(sessionId!, sessionData);
      }

      // Verifica token
      const dbSession = await prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { token: true }
      });

      if (!dbSession || dbSession.token !== this.hashToken(token!)) {
        await this.terminateSession(sessionId!, 'INVALID_TOKEN');
        return { valid: false };
      }

      const now = new Date();
      const warnings: string[] = [];

      // Verifica scadenza assoluta
      if (now > sessionData.expiresAt) {
        await this.terminateSession(sessionId!, 'ABSOLUTE_TIMEOUT');
        return { valid: false };
      }

      // Verifica timeout di inattività
      const inactivityMs = now.getTime() - sessionData.lastActivity.getTime();
      const inactivityMinutes = inactivityMs / 60000;
      
      if (inactivityMinutes > this.config.inactivityTimeout) {
        await this.terminateSession(sessionId!, 'INACTIVITY_TIMEOUT');
        return { valid: false };
      }

      // Warning per scadenza imminente
      const timeToExpiry = (sessionData.expiresAt.getTime() - now.getTime()) / 60000;
      if (timeToExpiry <= this.config.warningThreshold) {
        warnings.push(`Sessione scadrà in ${Math.round(timeToExpiry)} minuti`);
        
        // Incrementa contatore warning
        sessionData.metadata.warnings = (sessionData.metadata.warnings || 0) + 1;
        sessionData.metadata.lastWarning = now;
      }

      // Aggiorna ultima attività
      await this.updateSessionActivity(sessionId!);

      // Ottieni dati utente
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        select: {
          id: true,
          nome: true,
          ruolo: true,
          attivo: true
        }
      });

      if (!user || !user.attivo) {
        await this.terminateSession(sessionId!, 'USER_DEACTIVATED');
        return { valid: false };
      }

      return {
        valid: true,
        sessionData,
        user,
        warnings: warnings.length > 0 ? warnings : undefined,
        timeRemaining: Math.round(timeToExpiry)
      };

    } catch (error) {
      console.error('[Session] Errore validazione sessione:', error);
      return { valid: false };
    }
  }

  // Aggiorna attività sessione
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const now = new Date();
      
      // Aggiorna database
      await prisma.userSession.update({
        where: { id: sessionId },
        data: { lastActivity: now }
      });

      // Aggiorna cache
      const sessionData = this.activeSessions.get(sessionId);
      if (sessionData) {
        sessionData.lastActivity = now;
      }

    } catch (error) {
      console.error('[Session] Errore aggiornamento attività:', error);
    }
  }

  // Termina sessione
  async terminateSession(
    sessionId: string,
    reason: 'LOGOUT' | 'TIMEOUT' | 'INVALID_TOKEN' | 'NEW_DEVICE_LOGIN' | 'ADMIN_FORCE' | 'INACTIVITY_TIMEOUT' | 'ABSOLUTE_TIMEOUT' | 'USER_DEACTIVATED' | 'PASSWORD_CHANGE' | 'SECURITY_BREACH' = 'LOGOUT'
  ): Promise<void> {
    try {
      console.log(`[Session] Terminazione sessione ${sessionId} - Motivo: ${reason}`);

      const sessionData = this.activeSessions.get(sessionId);
      
      // Aggiorna database
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          terminatedAt: new Date(),
          terminationReason: reason
        }
      });

      // Rimuovi da cache
      this.activeSessions.delete(sessionId);

      // Audit log
      if (sessionData) {
        await auditService.logSecurityEvent('LOGOUT', sessionData.userId, sessionId, {
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
          success: true,
          metadata: {
            reason,
            sessionDuration: Date.now() - sessionData.createdAt.getTime()
          }
        });
      }

      // Pulisci cookie se è la sessione corrente
      this.clearSessionCookie();

    } catch (error) {
      console.error('[Session] Errore terminazione sessione:', error);
    }
  }

  // Termina tutte le sessioni di un utente
  async terminateAllUserSessions(
    userId: string,
    reason: 'ADMIN_FORCE' | 'PASSWORD_CHANGE' | 'SECURITY_BREACH' = 'ADMIN_FORCE',
    excludeSessionId?: string
  ): Promise<number> {
    try {
      const sessions = await this.getUserActiveSessions(userId);
      let terminated = 0;

      for (const session of sessions) {
        if (excludeSessionId && session.id === excludeSessionId) {
          continue;
        }
        
        await this.terminateSession(session.id, reason);
        terminated++;
      }

      console.log(`[Session] Terminate ${terminated} sessioni per utente ${userId}`);
      return terminated;

    } catch (error) {
      console.error('[Session] Errore terminazione sessioni utente:', error);
      return 0;
    }
  }

  // Ottieni sessioni attive di un utente
  async getUserActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const dbSessions = await prisma.userSession.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: {
          lastActivity: 'desc'
        }
      });

      return dbSessions.map(session => ({
        id: session.id,
        userId: session.userId,
        deviceId: session.deviceId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        metadata: session.metadata ? JSON.parse(session.metadata as string) : {}
      }));

    } catch (error) {
      console.error('[Session] Errore ottenimento sessioni utente:', error);
      return [];
    }
  }

  // Estendi sessione
  async extendSession(sessionId: string, additionalMinutes: number = 30): Promise<{
    success: boolean;
    newExpiresAt?: Date;
    error?: string;
  }> {
    try {
      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        return { success: false, error: 'Sessione non trovata' };
      }

      const newExpiresAt = new Date(Date.now() + additionalMinutes * 60 * 1000);
      
      // Non superare il limite massimo assoluto
      const maxExpiresAt = new Date(sessionData.createdAt.getTime() + this.config.absoluteTimeout * 60 * 1000);
      if (newExpiresAt > maxExpiresAt) {
        return { success: false, error: 'Limite massimo di sessione raggiunto' };
      }

      await prisma.userSession.update({
        where: { id: sessionId },
        data: { expiresAt: newExpiresAt }
      });

      sessionData.expiresAt = newExpiresAt;

      console.log(`[Session] Sessione ${sessionId} estesa fino a ${newExpiresAt.toLocaleString()}`);

      return { success: true, newExpiresAt };

    } catch (error) {
      console.error('[Session] Errore estensione sessione:', error);
      return { success: false, error: 'Errore durante l\'estensione' };
    }
  }

  // Pulizia sessioni scadute
  async cleanupExpiredSessions(): Promise<{ cleaned: number; errors: number }> {
    try {
      console.log('[Session] Inizio pulizia sessioni scadute');
      
      const now = new Date();
      let cleaned = 0;
      let errors = 0;

      // Trova sessioni scadute
      const expiredSessions = await prisma.userSession.findMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            {
              AND: [
                { isActive: true },
                {
                  lastActivity: {
                    lt: new Date(now.getTime() - this.config.inactivityTimeout * 60 * 1000)
                  }
                }
              ]
            }
          ]
        }
      });

      console.log(`[Session] Trovate ${expiredSessions.length} sessioni scadute`);

      // Marca come terminate
      for (const session of expiredSessions) {
        try {
          const reason = session.expiresAt < now ? 'ABSOLUTE_TIMEOUT' : 'INACTIVITY_TIMEOUT';
          await this.terminateSession(session.id, reason);
          cleaned++;
        } catch (error) {
          console.error(`[Session] Errore terminazione ${session.id}:`, error);
          errors++;
        }
      }

      // Pulisci sessioni molto vecchie dal database
      const oldCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 giorni fa
      const deletedCount = await prisma.userSession.deleteMany({
        where: {
          AND: [
            { isActive: false },
            { createdAt: { lt: oldCutoff } }
          ]
        }
      });

      console.log(`[Session] Pulizia completata: ${cleaned} terminate, ${deletedCount.count} eliminate, ${errors} errori`);

      return { cleaned, errors };

    } catch (error) {
      console.error('[Session] Errore pulizia sessioni:', error);
      return { cleaned: 0, errors: 1 };
    }
  }

  // Statistiche sessioni
  async getSessionStats(): Promise<{
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
    topDeviceTypes: Array<{ type: string; count: number }>;
    recentLogins: number;
    suspiciousActivity: number;
  }> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const [activeSessions, totalSessions, recentSessions] = await Promise.all([
        prisma.userSession.count({
          where: {
            isActive: true,
            expiresAt: { gt: now }
          }
        }),
        prisma.userSession.count(),
        prisma.userSession.findMany({
          where: {
            createdAt: { gte: oneDayAgo }
          },
          select: {
            createdAt: true,
            terminatedAt: true,
            metadata: true,
            ipAddress: true
          }
        })
      ]);

      // Calcola durata media sessioni completate
      const completedSessions = recentSessions.filter(s => s.terminatedAt);
      const averageSessionDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => {
            const duration = s.terminatedAt!.getTime() - s.createdAt.getTime();
            return sum + duration;
          }, 0) / completedSessions.length / 60000 // in minuti
        : 0;

      // Top device types
      const deviceTypes = new Map<string, number>();
      for (const session of recentSessions) {
        const metadata = session.metadata ? JSON.parse(session.metadata as string) : {};
        const deviceType = metadata.deviceType || 'Unknown';
        deviceTypes.set(deviceType, (deviceTypes.get(deviceType) || 0) + 1);
      }

      const topDeviceTypes = Array.from(deviceTypes.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Attività sospetta (più login dallo stesso IP)
      const ipCounts = new Map<string, number>();
      for (const session of recentSessions) {
        ipCounts.set(session.ipAddress, (ipCounts.get(session.ipAddress) || 0) + 1);
      }
      const suspiciousActivity = Array.from(ipCounts.values()).filter(count => count > 5).length;

      return {
        activeSessions,
        totalSessions,
        averageSessionDuration: Math.round(averageSessionDuration),
        topDeviceTypes,
        recentLogins: recentSessions.length,
        suspiciousActivity
      };

    } catch (error) {
      console.error('[Session] Errore statistiche:', error);
      throw error;
    }
  }

  // Utilità private
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  private generateSessionToken(): string {
    return randomBytes(64).toString('hex');
  }

  private generateDeviceId(userAgent: string, ipAddress: string): string {
    return createHash('sha256')
      .update(`${userAgent}:${ipAddress}:${process.env.DEVICE_SALT || 'default-salt'}`)
      .digest('hex')
      .substring(0, 16);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private detectDeviceType(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile';
    if (/Tablet/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  private async setSessionCookie(sessionId: string, token: string): Promise<void> {
    const cookieStore = await cookies();
    const value = `${sessionId}:${token}`;
    
    // In Next.js 15, usiamo cookies() direttamente
    (await cookies()).set({
      name: this.config.sessionCookieName,
      value: value,
      maxAge: this.config.sessionCookieMaxAge,
      httpOnly: true,
      secure: this.config.enableSecureCookies,
      sameSite: 'strict',
      path: '/'
    });
  }

  private async getSessionFromCookie(): Promise<{ sessionId: string; token: string } | null> {
    try {
      const cookieStore = await cookies();
      const cookie = cookieStore.get(this.config.sessionCookieName);
      
      if (!cookie?.value) return null;
      
      const [sessionId, token] = cookie.value.split(':');
      if (!sessionId || !token) return null;
      
      return { sessionId, token };
    } catch {
      return null;
    }
  }

  private async clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete({
      name: this.config.sessionCookieName
    });
  }

  private startSessionCleanup(): void {
    // Pulizia ogni 15 minuti
    this.sessionCleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        console.error('[Session] Errore pulizia automatica:', error);
      }
    }, 15 * 60 * 1000);
  }

  private stopSessionCleanup(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
  }

  // Aggiorna configurazione
  updateConfig(newConfig: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[Session] Configurazione aggiornata:', this.config);
  }

  // Ottieni configurazione
  getConfig(): SessionConfig {
    return { ...this.config };
  }

  // Cleanup per shutdown
  async shutdown(): Promise<void> {
    console.log('[Session] Shutdown session manager');
    this.stopSessionCleanup();
    
    // Termina tutte le sessioni attive
    const activeSessionIds = Array.from(this.activeSessions.keys());
    for (const sessionId of activeSessionIds) {
      await this.terminateSession(sessionId, 'ADMIN_FORCE');
    }
  }
}

// Istanza globale
export const sessionManager = new SessionManager();

// Job per pulizia periodica
export async function runSessionCleanupJob(): Promise<void> {
  try {
    await sessionManager.cleanupExpiredSessions();
  } catch (error) {
    console.error('[Session] Errore job pulizia:', error);
  }
}

// Middleware per controllo sessione
export function createSessionMiddleware() {
  return async (req: any, res: any, next: any) => {
    try {
      const validation = await sessionManager.validateSession();
      
      if (validation.valid && validation.sessionData && validation.user) {
        req.session = validation.sessionData;
        req.user = validation.user;
        
        if (validation.warnings && validation.warnings.length > 0) {
          res.setHeader('X-Session-Warnings', JSON.stringify(validation.warnings));
        }
        
        if (validation.timeRemaining && validation.timeRemaining <= 5) {
          res.setHeader('X-Session-Expiring', validation.timeRemaining.toString());
        }
      } else {
        // Sessione non valida
        res.status(401).json({ error: 'Sessione non valida o scaduta' });
        return;
      }
      
    } catch (error) {
      console.error('[Session] Errore middleware:', error);
      res.status(500).json({ error: 'Errore verifica sessione' });
      return;
    }
    
    next();
  };
}

// Helper per ottenere sessione corrente
export async function getCurrentSession(): Promise<{
  valid: boolean;
  sessionData?: SessionData;
  user?: any;
  warnings?: string[];
}> {
  return await sessionManager.validateSession();
}
