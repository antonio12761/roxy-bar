"use server";

import { prisma } from "@/lib/db";
import { auditService } from "./audit-service";
import { notificationManager } from "@/lib/notifications/NotificationManager";
import { sessionManager } from "./session-manager";

export interface ShiftData {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // minuti
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';
  breakTime: number; // minuti totali di pausa
  handoverNotes?: string;
  performance: {
    ordersHandled: number;
    revenue: number;
    customersServed: number;
    averageServiceTime: number;
    errorCount: number;
  };
  metadata: {
    location?: string;
    device?: string;
    handoverFrom?: string;
    handoverTo?: string;
    pauseReasons?: string[];
    alerts?: number;
  };
}

export interface ShiftHandover {
  id: string;
  fromUserId: string;
  toUserId: string;
  timestamp: Date;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
  notes: string;
  pendingOrders: string[];
  activeTables: string[];
  cashStatus: {
    startingCash: number;
    currentCash: number;
    transactions: number;
  };
  checklist: {
    item: string;
    completed: boolean;
    notes?: string;
  }[];
}

export interface ShiftConfig {
  maxShiftDuration: number; // ore
  requiredBreakTime: number; // minuti ogni X ore
  maxContinuousWork: number; // ore senza pausa
  enableAutomaticHandover: boolean;
  enableBreakReminders: boolean;
  handoverTimeout: number; // minuti per accettare handover
  preserveSessionData: boolean;
  trackPerformance: boolean;
}

export class ShiftManager {
  private config: ShiftConfig = {
    maxShiftDuration: 8, // 8 ore massime
    requiredBreakTime: 15, // 15 minuti di pausa ogni 4 ore
    maxContinuousWork: 4, // 4 ore massime senza pausa
    enableAutomaticHandover: true,
    enableBreakReminders: true,
    handoverTimeout: 10, // 10 minuti per accettare
    preserveSessionData: true,
    trackPerformance: true
  };

  private activeShifts = new Map<string, ShiftData>();
  private pendingHandovers = new Map<string, ShiftHandover>();

  constructor(config?: Partial<ShiftConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Inizia nuovo turno
  async startShift(
    userId: string,
    sessionId: string,
    ipAddress: string,
    location?: string,
    device?: string
  ): Promise<{
    shiftId: string;
    startTime: Date;
    previousShift?: ShiftData;
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

      console.log(`[Shift] Inizio turno per ${user.nome} (${userId})`);

      const warnings: string[] = [];
      const now = new Date();

      // Verifica se c'è un turno attivo precedente
      const activeShift = await this.getActiveShift(userId);
      let previousShift: ShiftData | undefined;

      if (activeShift) {
        if (this.config.enableAutomaticHandover) {
          // Completa automaticamente il turno precedente
          previousShift = await this.endShift(activeShift.id, 'AUTOMATIC_HANDOVER');
          warnings.push('Turno precedente completato automaticamente');
        } else {
          throw new Error('Turno già attivo. Completare il turno precedente.');
        }
      }

      // Crea nuovo turno
      const shiftId = `shift_${userId}_${now.getTime()}`;
      
      const shiftData: ShiftData = {
        id: shiftId,
        userId,
        userName: user.nome,
        userRole: user.ruolo,
        startTime: now,
        status: 'ACTIVE',
        breakTime: 0,
        performance: {
          ordersHandled: 0,
          revenue: 0,
          customersServed: 0,
          averageServiceTime: 0,
          errorCount: 0
        },
        metadata: {
          location,
          device,
          pauseReasons: [],
          alerts: 0
        }
      };

      // Salva nel database
      await prisma.userShift.create({
        data: {
          id: shiftId,
          userId,
          startTime: now,
          status: 'ACTIVE',
          breakTime: 0,
          performance: JSON.stringify(shiftData.performance),
          metadata: JSON.stringify(shiftData.metadata)
        }
      });

      // Aggiungi alla cache
      this.activeShifts.set(shiftId, shiftData);

      // Audit log
      await auditService.createAuditLog({
        entityType: 'USER',
        entityId: userId,
        action: 'SHIFT_START',
        userId,
        sessionId,
        metadata: {
          shiftId,
          location,
          device,
          previousShift: previousShift?.id
        },
        ipAddress,
        severity: 'LOW',
        category: 'SYSTEM',
        success: true
      });

      console.log(`[Shift] Turno ${shiftId} iniziato per ${user.nome}`);

      return {
        shiftId,
        startTime: now,
        previousShift,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error('[Shift] Errore inizio turno:', error);
      throw error;
    }
  }

  // Termina turno
  async endShift(
    shiftId: string,
    reason: 'NORMAL' | 'EMERGENCY' | 'HANDOVER' | 'AUTOMATIC_HANDOVER' | 'TIMEOUT' = 'NORMAL',
    handoverNotes?: string
  ): Promise<ShiftData> {
    try {
      const shiftData = this.activeShifts.get(shiftId);
      if (!shiftData) {
        throw new Error('Turno non trovato o già completato');
      }

      console.log(`[Shift] Fine turno ${shiftId} - Motivo: ${reason}`);

      const now = new Date();
      const duration = Math.floor((now.getTime() - shiftData.startTime.getTime()) / 60000); // minuti

      // Aggiorna performance finale
      if (this.config.trackPerformance) {
        const finalPerformance = await this.calculateShiftPerformance(shiftId, shiftData.userId);
        shiftData.performance = finalPerformance;
      }

      // Aggiorna dati turno
      shiftData.endTime = now;
      shiftData.duration = duration;
      shiftData.status = 'COMPLETED';
      shiftData.handoverNotes = handoverNotes;

      // Aggiorna database
      await prisma.userShift.update({
        where: { id: shiftId },
        data: {
          endTime: now,
          duration,
          status: 'COMPLETED',
          handoverNotes,
          performance: JSON.stringify(shiftData.performance),
          metadata: JSON.stringify(shiftData.metadata)
        }
      });

      // Rimuovi dalla cache
      this.activeShifts.delete(shiftId);

      // Audit log
      await auditService.createAuditLog({
        entityType: 'USER',
        entityId: shiftData.userId,
        action: 'SHIFT_END',
        userId: shiftData.userId,
        metadata: {
          shiftId,
          duration,
          reason,
          performance: shiftData.performance
        },
        severity: 'LOW',
        category: 'SYSTEM',
        success: true
      });

      console.log(`[Shift] Turno ${shiftId} completato: ${duration} minuti`);

      return shiftData;

    } catch (error) {
      console.error('[Shift] Errore fine turno:', error);
      throw error;
    }
  }

  // Avvia handover tra utenti
  async initiateHandover(
    fromUserId: string,
    toUserId: string,
    notes: string,
    sessionId: string
  ): Promise<{
    handoverId: string;
    pendingOrders: string[];
    activeTables: string[];
    timeout: Date;
  }> {
    try {
      const [fromUser, toUser] = await Promise.all([
        prisma.user.findUnique({ where: { id: fromUserId }, select: { nome: true, ruolo: true } }),
        prisma.user.findUnique({ where: { id: toUserId }, select: { nome: true, ruolo: true, attivo: true } })
      ]);

      if (!fromUser || !toUser || !toUser.attivo) {
        throw new Error('Utenti non validi per handover');
      }

      console.log(`[Shift] Handover iniziato: ${fromUser.nome} → ${toUser.nome}`);

      const handoverId = `handover_${Date.now()}`;
      const timeout = new Date(Date.now() + this.config.handoverTimeout * 60 * 1000);

      // Raccogli stato corrente
      const [pendingOrders, activeTables, cashStatus] = await Promise.all([
        this.getPendingOrdersForUser(fromUserId),
        this.getActiveTablesForUser(fromUserId),
        this.getCashStatusForUser(fromUserId)
      ]);

      // Crea checklist handover
      const checklist = [
        { item: 'Verifica ordini in sospeso', completed: false },
        { item: 'Controllo tavoli attivi', completed: false },
        { item: 'Verifica stato cassa', completed: false },
        { item: 'Briefing situazione turno', completed: false },
        { item: 'Trasferimento responsabilità', completed: false }
      ];

      const handover: ShiftHandover = {
        id: handoverId,
        fromUserId,
        toUserId,
        timestamp: new Date(),
        status: 'PENDING',
        notes,
        pendingOrders,
        activeTables,
        cashStatus,
        checklist
      };

      // Salva handover
      await prisma.shiftHandover.create({
        data: {
          id: handoverId,
          fromUserId,
          toUserId,
          status: 'PENDING',
          notes,
          pendingOrders: JSON.stringify(pendingOrders),
          activeTables: JSON.stringify(activeTables),
          cashStatus: JSON.stringify(cashStatus),
          checklist: JSON.stringify(checklist),
          timeout
        }
      });

      this.pendingHandovers.set(handoverId, handover);

      // Notifica utente destinazione
      // TODO: Implementare notifica cambio turno
      // await notificationManager.notifyShiftHandover({
      //   toUserId,
      //   fromUserName: fromUser.nome,
      //   handoverId,
      //   pendingOrdersCount: pendingOrders.length,
      //   activeTablesCount: activeTables.length,
      //   timeout
      // });

      // Audit log
      await auditService.createAuditLog({
        entityType: 'USER',
        entityId: fromUserId,
        action: 'HANDOVER_INITIATED',
        userId: fromUserId,
        sessionId,
        metadata: {
          handoverId,
          toUserId,
          pendingOrdersCount: pendingOrders.length,
          activeTablesCount: activeTables.length
        },
        severity: 'MEDIUM',
        category: 'SYSTEM',
        success: true,
        relatedEntityType: 'USER',
        relatedEntityId: toUserId
      });

      return {
        handoverId,
        pendingOrders,
        activeTables,
        timeout
      };

    } catch (error) {
      console.error('[Shift] Errore handover:', error);
      throw error;
    }
  }

  // Accetta handover
  async acceptHandover(
    handoverId: string,
    toUserId: string,
    sessionId: string
  ): Promise<{
    success: boolean;
    newShiftId?: string;
    transferredData?: any;
    error?: string;
  }> {
    try {
      const handover = this.pendingHandovers.get(handoverId);
      if (!handover || handover.toUserId !== toUserId) {
        return { success: false, error: 'Handover non trovato o non autorizzato' };
      }

      if (handover.status !== 'PENDING') {
        return { success: false, error: 'Handover già processato' };
      }

      // Recupera timeout dal database
      const dbHandover = await prisma.shiftHandover.findUnique({
        where: { id: handoverId },
        select: { timeout: true }
      });

      if (dbHandover && new Date() > dbHandover.timeout) {
        return { success: false, error: 'Handover scaduto' };
      }

      console.log(`[Shift] Handover ${handoverId} accettato da ${toUserId}`);

      // Inizia nuovo turno per utente destinazione
      const newShift = await this.startShift(
        toUserId,
        sessionId,
        '', // IP will be determined from session
        undefined,
        undefined
      );

      // Trasferisci dati se abilitato
      let transferredData = {};
      if (this.config.preserveSessionData) {
        transferredData = await this.transferSessionData(handover.fromUserId, toUserId);
      }

      // Completa turno utente precedente
      const fromShift = await this.getActiveShift(handover.fromUserId);
      if (fromShift) {
        await this.endShift(fromShift.id, 'HANDOVER', `Handover completato con ${toUserId}`);
      }

      // Aggiorna stato handover
      handover.status = 'COMPLETED';
      await prisma.shiftHandover.update({
        where: { id: handoverId },
        data: { status: 'COMPLETED' }
      });

      this.pendingHandovers.delete(handoverId);

      // Audit log
      await auditService.createAuditLog({
        entityType: 'USER',
        entityId: toUserId,
        action: 'HANDOVER_ACCEPTED',
        userId: toUserId,
        sessionId,
        metadata: {
          handoverId,
          fromUserId: handover.fromUserId,
          newShiftId: newShift.shiftId,
          transferredOrdersCount: handover.pendingOrders.length
        },
        severity: 'MEDIUM',
        category: 'SYSTEM',
        success: true,
        relatedEntityType: 'USER',
        relatedEntityId: handover.fromUserId
      });

      return {
        success: true,
        newShiftId: newShift.shiftId,
        transferredData
      };

    } catch (error) {
      console.error('[Shift] Errore accettazione handover:', error);
      return { success: false, error: 'Errore durante handover' };
    }
  }

  // Rifiuta handover
  async rejectHandover(
    handoverId: string,
    toUserId: string,
    reason: string
  ): Promise<boolean> {
    try {
      const handover = this.pendingHandovers.get(handoverId);
      if (!handover || handover.toUserId !== toUserId) {
        return false;
      }

      handover.status = 'REJECTED';
      await prisma.shiftHandover.update({
        where: { id: handoverId },
        data: { 
          status: 'REJECTED',
          rejectionReason: reason
        }
      });

      this.pendingHandovers.delete(handoverId);

      // Notifica utente mittente
      // TODO: Implementare notifica rifiuto handover
      // await notificationManager.notifyHandoverRejected({
      //   fromUserId: handover.fromUserId,
      //   rejectedByName: (await prisma.user.findUnique({ 
      //     where: { id: toUserId }, 
      //     select: { nome: true } 
      //   }))?.nome || 'Sconosciuto',
      //   reason
      // });

      return true;

    } catch (error) {
      console.error('[Shift] Errore rifiuto handover:', error);
      return false;
    }
  }

  // Ottieni turno attivo per utente
  async getActiveShift(userId: string): Promise<ShiftData | null> {
    try {
      // Cerca prima nella cache
      for (const [shiftId, shiftData] of this.activeShifts.entries()) {
        if (shiftData.userId === userId && shiftData.status === 'ACTIVE') {
          return shiftData;
        }
      }

      // Cerca nel database
      const dbShift = await prisma.userShift.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: {
          user: {
            select: { nome: true, ruolo: true }
          }
        }
      });

      if (!dbShift) return null;

      const shiftData: ShiftData = {
        id: dbShift.id,
        userId: dbShift.userId,
        userName: dbShift.user.nome,
        userRole: dbShift.user.ruolo,
        startTime: dbShift.startTime,
        endTime: dbShift.endTime || undefined,
        duration: dbShift.duration || undefined,
        status: dbShift.status as any,
        breakTime: dbShift.breakTime,
        handoverNotes: dbShift.handoverNotes || undefined,
        performance: dbShift.performance ? JSON.parse(dbShift.performance as string) : {
          ordersHandled: 0,
          revenue: 0,
          customersServed: 0,
          averageServiceTime: 0,
          errorCount: 0
        },
        metadata: dbShift.metadata ? JSON.parse(dbShift.metadata as string) : {}
      };

      this.activeShifts.set(dbShift.id, shiftData);
      return shiftData;

    } catch (error) {
      console.error('[Shift] Errore ottenimento turno attivo:', error);
      return null;
    }
  }

  // Calcola performance turno
  private async calculateShiftPerformance(shiftId: string, userId: string) {
    try {
      const shiftData = this.activeShifts.get(shiftId);
      if (!shiftData) return {
        ordersHandled: 0,
        revenue: 0,
        customersServed: 0,
        averageServiceTime: 0,
        errorCount: 0
      };

      const startTime = shiftData.startTime;
      const endTime = new Date();

      // Query per ordini gestiti durante il turno
      const orders = await prisma.ordinazione.findMany({
        where: {
          cameriereId: userId,
          dataApertura: {
            gte: startTime,
            lte: endTime
          }
        },
        include: {
          pagamenti: true,
          righe: true
        }
      });

      const ordersHandled = orders.length;
      const revenue = orders.reduce((sum, order) => 
        sum + order.pagamenti.reduce((pSum, payment) => 
          pSum + payment.importo.toNumber(), 0
        ), 0
      );

      // Stima clienti serviti (basata sui tavoli unici)
      const uniqueTables = new Set(orders.map(order => order.tavoloId).filter(Boolean));
      const customersServed = uniqueTables.size;

      // Tempo medio servizio (dalla creazione al pagamento)
      let totalServiceTime = 0;
      let completedOrders = 0;
      
      for (const order of orders) {
        if (order.pagamenti.length > 0) {
          const lastPayment = order.pagamenti.sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          )[0];
          
          const serviceTime = lastPayment.timestamp.getTime() - order.dataApertura.getTime();
          totalServiceTime += serviceTime;
          completedOrders++;
        }
      }

      const averageServiceTime = completedOrders > 0 
        ? Math.round(totalServiceTime / completedOrders / 60000) // in minuti
        : 0;

      // Conta errori dal log di audit (se disponibile)
      const errorCount = 0; // Da implementare con audit logs

      return {
        ordersHandled,
        revenue,
        customersServed,
        averageServiceTime,
        errorCount
      };

    } catch (error) {
      console.error('[Shift] Errore calcolo performance:', error);
      return {
        ordersHandled: 0,
        revenue: 0,
        customersServed: 0,
        averageServiceTime: 0,
        errorCount: 0
      };
    }
  }

  // Ottieni ordini in sospeso per utente
  private async getPendingOrdersForUser(userId: string): Promise<string[]> {
    try {
      const orders = await prisma.ordinazione.findMany({
        where: {
          cameriereId: userId,
          stato: {
            in: ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO']
          }
        },
        select: { id: true }
      });
      
      return orders.map(order => order.id);
    } catch (error) {
      console.error('[Shift] Errore ordini in sospeso:', error);
      return [];
    }
  }

  // Ottieni tavoli attivi per utente
  private async getActiveTablesForUser(userId: string): Promise<string[]> {
    try {
      const tables = await prisma.tavolo.findMany({
        where: {
          stato: 'OCCUPATO',
          ordinazioni: {
            some: {
              cameriereId: userId,
              stato: {
                not: 'PAGATO'
              }
            }
          }
        },
        select: { id: true }
      });
      
      return tables.map(table => table.id.toString());
    } catch (error) {
      console.error('[Shift] Errore tavoli attivi:', error);
      return [];
    }
  }

  // Ottieni stato cassa per utente
  private async getCashStatusForUser(userId: string) {
    try {
      // Implementazione base - da espandere secondo necessità
      return {
        startingCash: 0,
        currentCash: 0,
        transactions: 0
      };
    } catch (error) {
      console.error('[Shift] Errore stato cassa:', error);
      return {
        startingCash: 0,
        currentCash: 0,
        transactions: 0
      };
    }
  }

  // Trasferisce dati sessione tra utenti
  private async transferSessionData(fromUserId: string, toUserId: string) {
    try {
      // Questa funzione può essere estesa per trasferire:
      // - Stato tavoli in gestione
      // - Ordini parziali
      // - Preferenze interfaccia
      // - Cache dati
      
      console.log(`[Shift] Trasferimento dati da ${fromUserId} a ${toUserId}`);
      
      return {
        tablesTransferred: 0,
        ordersTransferred: 0,
        preferencesTransferred: false
      };
      
    } catch (error) {
      console.error('[Shift] Errore trasferimento dati:', error);
      return {};
    }
  }

  // Ottieni statistiche turni
  async getShiftStats(days: number = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const shifts = await prisma.userShift.findMany({
        where: {
          startTime: { gte: startDate },
          status: 'COMPLETED'
        },
        include: {
          user: {
            select: { nome: true, ruolo: true }
          }
        }
      });

      const totalShifts = shifts.length;
      const avgDuration = shifts.length > 0 
        ? shifts.reduce((sum, shift) => sum + (shift.duration || 0), 0) / shifts.length
        : 0;

      const handovers = await prisma.shiftHandover.count({
        where: {
          timestamp: { gte: startDate },
          status: 'COMPLETED'
        }
      });

      return {
        totalShifts,
        avgDuration: Math.round(avgDuration),
        successfulHandovers: handovers,
        activeShifts: this.activeShifts.size,
        pendingHandovers: this.pendingHandovers.size
      };

    } catch (error) {
      console.error('[Shift] Errore statistiche:', error);
      throw error;
    }
  }

  // Aggiorna configurazione
  updateConfig(newConfig: Partial<ShiftConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[Shift] Configurazione aggiornata:', this.config);
  }

  // Ottieni configurazione
  getConfig(): ShiftConfig {
    return { ...this.config };
  }
}

// Istanza globale
export const shiftManager = new ShiftManager();

// Helper per ottenere turno corrente
export async function getCurrentShift(userId: string): Promise<ShiftData | null> {
  return await shiftManager.getActiveShift(userId);
}

// Job per pulizia handover scaduti
export async function runShiftCleanupJob(): Promise<void> {
  try {
    console.log('[Shift] Inizio pulizia handover scaduti');
    
    const now = new Date();
    const expiredHandovers = await prisma.shiftHandover.findMany({
      where: {
        status: 'PENDING',
        timeout: { lt: now }
      }
    });

    for (const handover of expiredHandovers) {
      await prisma.shiftHandover.update({
        where: { id: handover.id },
        data: { 
          status: 'REJECTED',
          rejectionReason: 'Timeout scaduto'
        }
      });
      
      console.log(`[Shift] Handover ${handover.id} scaduto`);
    }
    
  } catch (error) {
    console.error('[Shift] Errore job pulizia:', error);
  }
}
