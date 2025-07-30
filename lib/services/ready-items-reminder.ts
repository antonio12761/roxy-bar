"use server";

import { prisma } from "@/lib/db";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export interface ReadyItemReminder {
  id: string;
  ordinazioneId: string;
  tavoloNumero: string;
  cameriereId: string;
  cameriereNome: string;
  prodotti: Array<{
    nome: string;
    quantita: number;
    postazione: string;
    minutiPronti: number;
  }>;
  totaleProdotti: number;
  minutiMassimiAttesa: number;
  urgenza: 'normale' | 'alta' | 'critica';
  ultimoPromemoria?: Date;
}

export interface ReminderConfig {
  thresholdMinutes: number;      // Soglia iniziale (default: 10 minuti)
  escalationMinutes: number;     // Escalation (default: 15 minuti)
  criticalMinutes: number;       // Critico (default: 20 minuti)
  reminderInterval: number;      // Intervallo promemoria (default: 5 minuti)
  enabledStations: ('PREPARA' | 'CUCINA')[];
  notifyManagers: boolean;       // Notifica manager per casi critici
}

export class ReadyItemsReminderManager {
  private config: ReminderConfig = {
    thresholdMinutes: 10,
    escalationMinutes: 15,
    criticalMinutes: 20,
    reminderInterval: 5,
    enabledStations: ['PREPARA', 'CUCINA'],
    notifyManagers: true
  };

  private sentReminders = new Map<string, Date>();

  constructor(config?: Partial<ReminderConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Trova prodotti pronti non ritirati
  async findReadyItemsNotCollected(): Promise<ReadyItemReminder[]> {
    try {
      const thresholdTime = new Date(Date.now() - this.config.thresholdMinutes * 60 * 1000);
      
      console.log(`[Reminder] Ricerca prodotti pronti da prima di ${thresholdTime.toLocaleString()}`);

      // Query ottimizzata per prodotti pronti non ritirati
      const righePronte = await prisma.rigaOrdinazione.findMany({
        where: {
          stato: 'PRONTO',
          postazione: {
            in: this.config.enabledStations
          },
          timestampPronto: {
            lte: thresholdTime
          }
        },
        include: {
          prodotto: {
            select: {
              nome: true
            }
          },
          ordinazione: {
            select: {
              id: true,
              numero: true,
              nomeCliente: true,
              cameriereId: true,
              tavolo: {
                select: {
                  numero: true
                }
              },
              cameriere: {
                select: {
                  nome: true
                }
              }
            }
          }
        },
        orderBy: {
          timestampPronto: 'asc' // Più vecchi prima
        }
      });

      if (righePronte.length === 0) {
        return [];
      }

      // Raggruppa per ordinazione
      const reminderMap = new Map<string, ReadyItemReminder>();
      const now = new Date();

      for (const riga of righePronte) {
        const ordinazioneId = riga.ordinazioneId;
        const minutiPronti = Math.floor(
          (now.getTime() - (riga.timestampPronto?.getTime() || 0)) / 60000
        );

        if (!reminderMap.has(ordinazioneId)) {
          const urgenza = this.calculateUrgency(minutiPronti);
          
          reminderMap.set(ordinazioneId, {
            id: `reminder-${ordinazioneId}`,
            ordinazioneId,
            tavoloNumero: riga.ordinazione.tavolo?.numero || 'Asporto',
            cameriereId: riga.ordinazione.cameriereId,
            cameriereNome: riga.ordinazione.cameriere.nome,
            prodotti: [],
            totaleProdotti: 0,
            minutiMassimiAttesa: 0,
            urgenza,
            ultimoPromemoria: this.sentReminders.get(ordinazioneId)
          });
        }

        const reminder = reminderMap.get(ordinazioneId)!;
        
        reminder.prodotti.push({
          nome: riga.prodotto.nome,
          quantita: riga.quantita,
          postazione: riga.postazione,
          minutiPronti
        });
        
        reminder.totaleProdotti += riga.quantita;
        reminder.minutiMassimiAttesa = Math.max(reminder.minutiMassimiAttesa, minutiPronti);
        
        // Aggiorna urgenza se necessario
        const newUrgency = this.calculateUrgency(reminder.minutiMassimiAttesa);
        if (this.getUrgencyLevel(newUrgency) > this.getUrgencyLevel(reminder.urgenza)) {
          reminder.urgenza = newUrgency;
        }
      }

      const reminders = Array.from(reminderMap.values());
      
      console.log(`[Reminder] Trovati ${reminders.length} promemoria da inviare`);
      
      return reminders;

    } catch (error) {
      console.error('[Reminder] Errore ricerca prodotti pronti:', error);
      return [];
    }
  }

  // Calcola urgenza basata sui minuti di attesa
  private calculateUrgency(minutes: number): 'normale' | 'alta' | 'critica' {
    if (minutes >= this.config.criticalMinutes) return 'critica';
    if (minutes >= this.config.escalationMinutes) return 'alta';
    return 'normale';
  }

  // Converte urgenza in livello numerico per confronti
  private getUrgencyLevel(urgency: 'normale' | 'alta' | 'critica'): number {
    switch (urgency) {
      case 'normale': return 1;
      case 'alta': return 2;
      case 'critica': return 3;
      default: return 0;
    }
  }

  // Invia promemoria per un singolo reminder
  async sendReminder(reminder: ReadyItemReminder): Promise<boolean> {
    try {
      const now = new Date();
      const lastReminder = this.sentReminders.get(reminder.ordinazioneId);
      
      // Controlla se è troppo presto per un nuovo promemoria
      if (lastReminder) {
        const minutesSinceLastReminder = Math.floor(
          (now.getTime() - lastReminder.getTime()) / 60000
        );
        
        if (minutesSinceLastReminder < this.config.reminderInterval) {
          console.log(`[Reminder] Troppo presto per nuovo promemoria ordine ${reminder.ordinazioneId}`);
          return false;
        }
      }

      // Prepara dati per notifica
      const message = this.formatReminderMessage(reminder);
      const stazioni = [...new Set(reminder.prodotti.map(p => p.postazione))];
      
      // TODO: Implementare notifica reminder items pronti
      // await notificationManager.notifyReadyItemsReminder({
      //   cameriereId: reminder.cameriereId,
      //   tableNumber: parseInt(reminder.tavoloNumero) || 0,
      //   orderId: reminder.ordinazioneId,
      //   items: reminder.prodotti,
      //   waitTimeMinutes: reminder.minutiMassimiAttesa,
      //   urgency: reminder.urgenza,
      //   stations: stazioni
      // });

      // Per casi critici, notifica anche i manager
      if (reminder.urgenza === 'critica' && this.config.notifyManagers) {
        await this.notifyManagers(reminder);
      }

      // Registra promemoria inviato
      this.sentReminders.set(reminder.ordinazioneId, now);
      
      console.log(`[Reminder] Promemoria ${reminder.urgenza} inviato per ordine ${reminder.ordinazioneId} (${reminder.minutiMassimiAttesa}m)`);
      
      return true;

    } catch (error) {
      console.error(`[Reminder] Errore invio promemoria ${reminder.ordinazioneId}:`, error);
      return false;
    }
  }

  // Formatta messaggio promemoria
  private formatReminderMessage(reminder: ReadyItemReminder): string {
    const stazioni = [...new Set(reminder.prodotti.map(p => p.postazione))];
    const stazioniStr = stazioni.map(s => s === 'PREPARA' ? 'Bar' : 'Cucina').join(' e ');
    
    let message = `⏰ Tavolo ${reminder.tavoloNumero}: `;
    
    if (reminder.urgenza === 'critica') {
      message += `🚨 CRITICO - `;
    } else if (reminder.urgenza === 'alta') {
      message += `⚡ URGENTE - `;
    }
    
    message += `${reminder.totaleProdotti} prodotti pronti da ${reminder.minutiMassimiAttesa} minuti in ${stazioniStr}`;
    
    return message;
  }

  // Notifica manager per casi critici
  private async notifyManagers(reminder: ReadyItemReminder): Promise<void> {
    try {
      // Trova tutti i manager/supervisori
      const managers = await prisma.user.findMany({
        where: {
          ruolo: {
            in: ['MANAGER', 'SUPERVISORE', 'ADMIN']
          },
          attivo: true
        },
        select: {
          id: true,
          nome: true
        }
      });

      // TODO: Implementare notifica ritardo critico ai manager
      // for (const manager of managers) {
      //   await notificationManager.notifyCriticalDelay({
      //     managerId: manager.id,
      //     tableNumber: parseInt(reminder.tavoloNumero) || 0,
      //     cameriereId: reminder.cameriereId,
      //     cameriereNome: reminder.cameriereNome,
      //     orderId: reminder.ordinazioneId,
      //     items: reminder.prodotti,
      //     waitTimeMinutes: reminder.minutiMassimiAttesa
      //   });
      // }

      console.log(`[Reminder] Notifica critica inviata a ${managers.length} manager per ordine ${reminder.ordinazioneId}`);

    } catch (error) {
      console.error('[Reminder] Errore notifica manager:', error);
    }
  }

  // Processo completo di invio promemoria
  async processReminders(): Promise<{
    found: number;
    sent: number;
    normale: number;
    alta: number;
    critica: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    console.log('[Reminder] Inizio processo promemoria prodotti pronti');

    const reminders = await this.findReadyItemsNotCollected();
    const results = {
      found: reminders.length,
      sent: 0,
      normale: 0,
      alta: 0,
      critica: 0,
      errors: [] as string[]
    };

    for (const reminder of reminders) {
      try {
        const sent = await this.sendReminder(reminder);
        
        if (sent) {
          results.sent++;
          results[reminder.urgenza]++;
        }

      } catch (error) {
        const errorMsg = `Ordine ${reminder.ordinazioneId}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
        results.errors.push(errorMsg);
        console.error(`[Reminder] ${errorMsg}`);
      }
    }

    const processTime = Date.now() - startTime;
    console.log(`[Reminder] Processo completato in ${processTime}ms:`, results);

    return results;
  }

  // Ottieni statistiche promemoria
  async getReminderStats(hours: number = 24): Promise<{
    period: string;
    totalReminders: number;
    byUrgency: { normale: number; alta: number; critica: number };
    avgWaitTime: number;
    maxWaitTime: number;
    topDelayedStations: Array<{ station: string; count: number; avgMinutes: number }>;
  }> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Simula statistiche basate sui dati attuali
      const reminders = await this.findReadyItemsNotCollected();
      
      const stats = {
        period: `${hours} ore`,
        totalReminders: reminders.length,
        byUrgency: {
          normale: reminders.filter(r => r.urgenza === 'normale').length,
          alta: reminders.filter(r => r.urgenza === 'alta').length,
          critica: reminders.filter(r => r.urgenza === 'critica').length
        },
        avgWaitTime: reminders.length > 0 
          ? Math.round(reminders.reduce((sum, r) => sum + r.minutiMassimiAttesa, 0) / reminders.length)
          : 0,
        maxWaitTime: reminders.length > 0
          ? Math.max(...reminders.map(r => r.minutiMassimiAttesa))
          : 0,
        topDelayedStations: this.calculateStationStats(reminders)
      };

      return stats;

    } catch (error) {
      console.error('[Reminder] Errore statistiche:', error);
      throw error;
    }
  }

  // Calcola statistiche per stazione
  private calculateStationStats(reminders: ReadyItemReminder[]) {
    const stationMap = new Map<string, { count: number; totalMinutes: number }>();
    
    for (const reminder of reminders) {
      for (const prodotto of reminder.prodotti) {
        const existing = stationMap.get(prodotto.postazione) || { count: 0, totalMinutes: 0 };
        existing.count += prodotto.quantita;
        existing.totalMinutes += prodotto.minutiPronti * prodotto.quantita;
        stationMap.set(prodotto.postazione, existing);
      }
    }

    return Array.from(stationMap.entries())
      .map(([station, data]) => ({
        station: station === 'PREPARA' ? 'Bar' : 'Cucina',
        count: data.count,
        avgMinutes: Math.round(data.totalMinutes / data.count)
      }))
      .sort((a, b) => b.avgMinutes - a.avgMinutes);
  }

  // Aggiorna configurazione
  updateConfig(newConfig: Partial<ReminderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[Reminder] Configurazione aggiornata:', this.config);
  }

  // Ottieni configurazione corrente
  getConfig(): ReminderConfig {
    return { ...this.config };
  }

  // Pulisci promemoria vecchi
  clearOldReminders(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000); // 1 ora fa
    
    let cleared = 0;
    for (const [orderId, timestamp] of this.sentReminders.entries()) {
      if (timestamp < cutoff) {
        this.sentReminders.delete(orderId);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`[Reminder] Puliti ${cleared} promemoria vecchi`);
    }
  }
}

// Istanza globale
export const readyItemsReminderManager = new ReadyItemsReminderManager();

// Job per esecuzione periodica (da chiamare ogni 2-3 minuti)
export async function runReadyItemsReminderJob(): Promise<void> {
  try {
    // Pulisci promemoria vecchi
    readyItemsReminderManager.clearOldReminders();
    
    // Processa promemoria
    await readyItemsReminderManager.processReminders();
    
  } catch (error) {
    console.error('[Reminder] Errore job periodico:', error);
  }
}