"use server";

import { prisma } from "@/lib/db";
import { EntityType, AuditAction, AuditSeverity, AuditCategory } from "@prisma/client";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export interface AuditLogEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  userId?: string;
  sessionId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity: AuditSeverity;
  category: AuditCategory;
  success: boolean;
  errorMessage?: string;
  processingTime?: number;
  relatedEntityType?: EntityType;
  relatedEntityId?: string;
  timestamp: Date;
  tenantId: string;
}

export interface AuditSearchFilters {
  entityType?: EntityType;
  entityId?: string;
  action?: AuditAction;
  userId?: string;
  sessionId?: string;
  severity?: AuditSeverity;
  category?: AuditCategory;
  success?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
  relatedEntityId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEntries: number;
  byAction: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  successRate: number;
  avgProcessingTime: number;
  topUsers: Array<{ userId: string; userName: string; count: number }>;
  criticalEvents: number;
  securityEvents: number;
  recentActivity: number;
}

export class AuditService {
  
  // Crea nuovo log di audit
  static async createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    try {
      const startTime = Date.now();
      
      // Valida e prepara i dati
      const auditData = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        userId: entry.userId || null,
        sessionId: entry.sessionId || null,
        oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : undefined,
        newValues: entry.newValues ? JSON.stringify(entry.newValues) : undefined,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        severity: entry.severity,
        category: entry.category,
        success: entry.success,
        errorMessage: entry.errorMessage || null,
        processingTime: entry.processingTime || (Date.now() - startTime),
        relatedEntityType: entry.relatedEntityType || null,
        relatedEntityId: entry.relatedEntityId || null,
        tenantId: entry.tenantId,
        fieldNames: [],
        changes: undefined,
        tableName: undefined,
        checksum: undefined,
        sensitive: false,
        validated: false
      };

      const auditLog = await prisma.auditLog.create({
        data: auditData,
        include: {
          User: {
            select: {
              nome: true,
              ruolo: true
            }
          }
        }
      });

      // Notifica per eventi critici o di sicurezza
      if (entry.severity === 'CRITICAL' || entry.category === 'SECURITY') {
        await this.notifyCriticalAuditEvent(auditLog);
      }

      console.log(`[Audit] ${entry.action} logged for ${entry.entityType}(${entry.entityId})`);
      
      return {
        ...auditLog,
        userId: auditLog.userId || undefined,
        sessionId: auditLog.sessionId || undefined,
        ipAddress: auditLog.ipAddress || undefined,
        userAgent: auditLog.userAgent || undefined,
        errorMessage: auditLog.errorMessage || undefined,
        relatedEntityType: auditLog.relatedEntityType || undefined,
        relatedEntityId: auditLog.relatedEntityId || undefined,
        oldValues: auditLog.oldValues ? JSON.parse(auditLog.oldValues as string) : undefined,
        newValues: auditLog.newValues ? JSON.parse(auditLog.newValues as string) : undefined,
        metadata: auditLog.metadata ? JSON.parse(auditLog.metadata as string) : undefined,
        timestamp: auditLog.createdAt
      } as AuditLogEntry;

    } catch (error) {
      console.error('[Audit] Errore creazione log:', error);
      throw error;
    }
  }

  // Log specifico per pagamenti
  static async logPaymentAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PROCESS',
    paymentId: string,
    userId: string,
    sessionId: string,
    details: {
      oldValues?: any;
      newValues?: any;
      amount?: number;
      method?: string;
      ordinazioneId?: string;
      tableNumber?: string;
      success: boolean;
      errorMessage?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      const auditAction = this.mapToAuditAction('PAYMENT', action);
      const severity = details.success ? 'LOW' : 'MEDIUM';
      
      if (!details.success && details.amount && details.amount > 100) {
        // Pagamento fallito di importo elevato
        severity as 'HIGH';
      }

      const metadata = {
        amount: details.amount,
        paymentMethod: details.method,
        tableNumber: details.tableNumber,
        ordinazioneId: details.ordinazioneId,
        timestamp: new Date().toISOString()
      };

      await this.createAuditLog({
        entityType: 'PAGAMENTO',
        entityId: paymentId,
        action: auditAction,
        userId,
        sessionId,
        oldValues: details.oldValues,
        newValues: details.newValues,
        metadata,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        severity: severity as AuditSeverity,
        category: 'PAYMENT',
        success: details.success,
        errorMessage: details.errorMessage,
        relatedEntityType: details.ordinazioneId ? 'ORDINAZIONE' : undefined,
        relatedEntityId: details.ordinazioneId,
        tenantId: '' // TODO: Get tenantId from context
      });

    } catch (error) {
      console.error('[Audit] Errore log pagamento:', error);
    }
  }

  // Log per ordinazioni
  static async logOrderAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE',
    orderId: string,
    userId: string,
    sessionId: string,
    details: {
      oldValues?: any;
      newValues?: any;
      tableId?: string;
      items?: any[];
      totalAmount?: number;
      success: boolean;
      errorMessage?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      const auditAction = this.mapToAuditAction('ORDER', action);
      const severity: AuditSeverity = details.success ? 'LOW' : 'MEDIUM';

      const metadata = {
        tableId: details.tableId,
        itemCount: details.items?.length,
        totalAmount: details.totalAmount,
        timestamp: new Date().toISOString()
      };

      await this.createAuditLog({
        entityType: 'ORDINAZIONE',
        entityId: orderId,
        action: auditAction,
        userId,
        sessionId,
        oldValues: details.oldValues,
        newValues: details.newValues,
        metadata,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        severity,
        category: 'ORDER',
        success: details.success,
        errorMessage: details.errorMessage,
        relatedEntityType: details.tableId ? 'TAVOLO' : undefined,
        relatedEntityId: details.tableId,
        tenantId: '' // TODO: Get tenantId from context
      });

    } catch (error) {
      console.error('[Audit] Errore log ordinazione:', error);
    }
  }

  // Log per eventi di sicurezza
  static async logSecurityEvent(
    event: 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED' | 'SUSPICIOUS_ACTIVITY',
    userId: string,
    sessionId: string,
    details: {
      resource?: string;
      ipAddress?: string;
      userAgent?: string;
      success: boolean;
      errorMessage?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const auditAction = this.mapToAuditAction('SECURITY', event);
      const severity: AuditSeverity = details.success ? 'LOW' : 'HIGH';

      await this.createAuditLog({
        entityType: 'USER',
        entityId: userId,
        action: auditAction,
        userId,
        sessionId,
        metadata: {
          event,
          resource: details.resource,
          ...details.metadata,
          timestamp: new Date().toISOString()
        },
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        severity,
        category: 'SECURITY',
        success: details.success,
        errorMessage: details.errorMessage,
        tenantId: '' // TODO: Get tenantId from context
      });

    } catch (error) {
      console.error('[Audit] Errore log sicurezza:', error);
    }
  }

  // Ricerca log di audit
  static async searchAuditLogs(filters: AuditSearchFilters): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const where: any = {};
      
      if (filters.entityType) where.entityType = filters.entityType;
      if (filters.entityId) where.entityId = filters.entityId;
      if (filters.action) where.action = filters.action;
      if (filters.userId) where.userId = filters.userId;
      if (filters.sessionId) where.sessionId = filters.sessionId;
      if (filters.severity) where.severity = filters.severity;
      if (filters.category) where.category = filters.category;
      if (filters.success !== undefined) where.success = filters.success;
      if (filters.ipAddress) where.ipAddress = filters.ipAddress;
      if (filters.relatedEntityId) where.relatedEntityId = filters.relatedEntityId;
      
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            User: {
              select: {
                nome: true,
                ruolo: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: offset
        }),
        prisma.auditLog.count({ where })
      ]);

      const formattedLogs = logs.map(log => ({
        ...log,
        userId: log.userId || undefined,
        sessionId: log.sessionId || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        errorMessage: log.errorMessage || undefined,
        relatedEntityType: log.relatedEntityType || undefined,
        relatedEntityId: log.relatedEntityId || undefined,
        oldValues: log.oldValues ? JSON.parse(log.oldValues as string) : undefined,
        newValues: log.newValues ? JSON.parse(log.newValues as string) : undefined,
        metadata: log.metadata ? JSON.parse(log.metadata as string) : undefined,
        timestamp: log.createdAt
      })) as AuditLogEntry[];

      return {
        logs: formattedLogs,
        total,
        hasMore: offset + limit < total
      };

    } catch (error) {
      console.error('[Audit] Errore ricerca log:', error);
      throw error;
    }
  }

  // Statistiche audit
  static async getAuditStats(days: number = 30): Promise<AuditStats> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const [totalEntries, actionStats, severityStats, categoryStats, userStats] = await Promise.all([
        prisma.auditLog.count({
          where: {
            createdAt: { gte: startDate }
          }
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: {
            createdAt: { gte: startDate }
          },
          _count: { id: true }
        }),
        prisma.auditLog.groupBy({
          by: ['severity'],
          where: {
            createdAt: { gte: startDate }
          },
          _count: { id: true }
        }),
        prisma.auditLog.groupBy({
          by: ['category'],
          where: {
            createdAt: { gte: startDate }
          },
          _count: { id: true }
        }),
        prisma.auditLog.groupBy({
          by: ['userId'],
          where: {
            createdAt: { gte: startDate },
            userId: { not: null }
          },
          _count: { id: true },
          orderBy: {
            _count: { id: 'desc' }
          },
          take: 10
        })
      ]);

      // Calcola statistiche aggregate
      const successCount = await prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          success: true
        }
      });

      const avgProcessingTime = await prisma.auditLog.aggregate({
        where: {
          createdAt: { gte: startDate },
          processingTime: { not: null }
        },
        _avg: {
          processingTime: true
        }
      });

      const criticalEvents = await prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          severity: 'CRITICAL'
        }
      });

      const securityEvents = await prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          category: 'SECURITY'
        }
      });

      // Ottieni nomi utenti
      const userIds = userStats.map(u => u.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nome: true }
      });

      const topUsers = userStats.map(stat => {
        const user = users.find(u => u.id === stat.userId);
        return {
          userId: stat.userId || 'Unknown',
          userName: user?.nome || 'Unknown',
          count: stat._count.id
        };
      });

      return {
        totalEntries,
        byAction: Object.fromEntries(actionStats.map(s => [s.action, s._count.id])),
        bySeverity: Object.fromEntries(severityStats.map(s => [s.severity, s._count.id])),
        byCategory: Object.fromEntries(categoryStats.map(s => [s.category, s._count.id])),
        successRate: totalEntries > 0 ? (successCount / totalEntries) * 100 : 0,
        avgProcessingTime: avgProcessingTime._avg.processingTime || 0,
        topUsers,
        criticalEvents,
        securityEvents,
        recentActivity: await this.getRecentActivityCount(1) // Ultima ora
      };

    } catch (error) {
      console.error('[Audit] Errore statistiche:', error);
      throw error;
    }
  }

  // Pulisci log vecchi (retention policy)
  static async cleanupOldLogs(retentionDays: number = 90): Promise<{
    deleted: number;
    oldestRemaining: Date | null;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      console.log(`[Audit] Pulizia log più vecchi di ${cutoffDate.toLocaleDateString()}`);
      
      // Non eliminare log critici o di sicurezza
      const { count } = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          severity: { not: 'CRITICAL' },
          category: { not: 'SECURITY' }
        }
      });

      const oldestLog = await prisma.auditLog.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      });

      console.log(`[Audit] Eliminati ${count} log obsoleti`);

      return {
        deleted: count,
        oldestRemaining: oldestLog?.createdAt || null
      };

    } catch (error) {
      console.error('[Audit] Errore pulizia log:', error);
      throw error;
    }
  }

  // Utilità private
  private static mapToAuditAction(context: string, action: string): AuditAction {
    const mapping: Record<string, AuditAction> = {
      'PAYMENT_CREATE': 'CREATE',
      'PAYMENT_UPDATE': 'UPDATE',
      'PAYMENT_DELETE': 'DELETE',
      'PAYMENT_PROCESS': 'PROCESS',
      'ORDER_CREATE': 'CREATE',
      'ORDER_UPDATE': 'UPDATE',
      'ORDER_DELETE': 'DELETE',
      'ORDER_COMPLETE': 'COMPLETE',
      'SECURITY_LOGIN': 'LOGIN',
      'SECURITY_LOGOUT': 'LOGOUT',
      'SECURITY_ACCESS_DENIED': 'ACCESS_DENIED',
      'SECURITY_SUSPICIOUS_ACTIVITY': 'SECURITY_VIOLATION'
    };

    const key = `${context}_${action}`;
    return mapping[key] || 'UPDATE';
  }

  private static async notifyCriticalAuditEvent(auditLog: any): Promise<void> {
    try {
      // Notifica amministratori per eventi critici
      const admins = await prisma.user.findMany({
        where: {
          ruolo: { in: ['ADMIN', 'MANAGER'] },
          attivo: true
        },
        select: { id: true, nome: true }
      });

      // TODO: Implement critical audit event notification
      // for (const admin of admins) {
      //   await notificationManager.notifyCriticalAuditEvent({
      //     adminId: admin.id,
      //     auditLogId: auditLog.id,
      //     entityType: auditLog.entityType,
      //     entityId: auditLog.entityId,
      //     action: auditLog.action,
      //     severity: auditLog.severity,
      //     errorMessage: auditLog.errorMessage
      //   });
      // }

    } catch (error) {
      console.error('[Audit] Errore notifica evento critico:', error);
    }
  }

  private static async getRecentActivityCount(hours: number): Promise<number> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await prisma.auditLog.count({
      where: {
        createdAt: { gte: startTime }
      }
    });
  }

  // Export per utilizzo in middleware
  static async logRequest(
    method: string,
    path: string,
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    processingTime?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.createAuditLog({
        entityType: 'SYSTEM',
        entityId: `${method}:${path}`,
        action: 'ACCESS',
        userId,
        sessionId,
        metadata: {
          method,
          path,
          timestamp: new Date().toISOString()
        },
        ipAddress,
        userAgent,
        severity: success ? 'LOW' : 'MEDIUM',
        category: 'SYSTEM',
        success,
        processingTime,
        errorMessage,
        tenantId: '' // TODO: Get tenantId from context
      });
    } catch (error) {
      console.error('[Audit] Errore log richiesta:', error);
    }
  }
}

// Istanza globale per accesso rapido
export const auditService = AuditService;

// Job di pulizia da eseguire periodicamente
export async function runAuditCleanupJob(): Promise<void> {
  try {
    console.log('[Audit] Inizio job pulizia log');
    
    const result = await AuditService.cleanupOldLogs(90); // 90 giorni di retention
    
    console.log(`[Audit] Job completato: ${result.deleted} log eliminati`);
    
  } catch (error) {
    console.error('[Audit] Errore job pulizia:', error);
  }
}

// Middleware helper
export function createAuditMiddleware() {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Estrai informazioni dalla richiesta
    const method = req.method;
    const path = req.url;
    const userId = req.user?.id;
    const sessionId = req.session?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    res.on('finish', async () => {
      const processingTime = Date.now() - startTime;
      const success = res.statusCode < 400;
      const errorMessage = success ? undefined : `HTTP ${res.statusCode}`;
      
      // Log solo per operazioni significative (non assets statici)
      if (path.startsWith('/api/')) {
        await AuditService.logRequest(
          method,
          path,
          userId,
          sessionId,
          ipAddress,
          userAgent,
          success,
          processingTime,
          errorMessage
        );
      }
    });
    
    next();
  };
}
