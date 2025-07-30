"use client";

import { useState, useEffect } from 'react';
import { globalCache } from './intelligent-cache';

export interface OfflineAction {
  id: string;
  type: 'CREATE_ORDER' | 'UPDATE_ORDER' | 'PROCESS_PAYMENT' | 'UPDATE_STATUS';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  critical: boolean;
}

export interface OfflineState {
  isOnline: boolean;
  lastOnline: Date;
  pendingActions: OfflineAction[];
  syncInProgress: boolean;
  conflicts: any[];
}

export class OfflineManager {
  private state: OfflineState = {
    isOnline: navigator.onLine,
    lastOnline: new Date(),
    pendingActions: [],
    syncInProgress: false,
    conflicts: []
  };

  private listeners: ((state: OfflineState) => void)[] = [];
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeNetworkListeners();
    this.loadPersistedState();
    this.startSyncTimer();
  }

  // Inizializza listeners di rete
  private initializeNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[Offline] Connessione ripristinata');
      this.state.isOnline = true;
      this.state.lastOnline = new Date();
      this.notifyListeners();
      this.syncPendingActions();
    });

    window.addEventListener('offline', () => {
      console.log('[Offline] Connessione persa - modalità offline attivata');
      this.state.isOnline = false;
      this.notifyListeners();
    });
  }

  // Carica stato da localStorage
  private loadPersistedState() {
    try {
      const saved = localStorage.getItem('offline_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state.pendingActions = parsed.pendingActions || [];
        this.state.conflicts = parsed.conflicts || [];
        console.log(`[Offline] Caricate ${this.state.pendingActions.length} azioni in sospeso`);
      }
    } catch (error) {
      console.error('[Offline] Errore caricamento stato:', error);
    }
  }

  // Salva stato in localStorage
  private persistState() {
    try {
      localStorage.setItem('offline_state', JSON.stringify({
        pendingActions: this.state.pendingActions,
        conflicts: this.state.conflicts,
        lastSaved: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[Offline] Errore salvataggio stato:', error);
    }
  }

  // Aggiungi listener per cambi di stato
  subscribe(listener: (state: OfflineState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notifica listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  // Esegui azione con fallback offline
  async executeAction<T>(
    action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>,
    onlineExecutor: () => Promise<T>,
    offlineHandler?: (data: any) => T
  ): Promise<T> {
    
    if (this.state.isOnline) {
      try {
        console.log(`[Offline] Esecuzione online: ${action.type}`);
        const result = await onlineExecutor();
        
        // Se l'azione è riuscita online, rimuovi eventuali versioni offline
        this.removePendingAction(action.type, action.data);
        
        return result;
      } catch (error) {
        console.error(`[Offline] Errore esecuzione online ${action.type}:`, error);
        
        // Se l'errore è di rete, passa alla modalità offline
        if (this.isNetworkError(error)) {
          this.state.isOnline = false;
          this.notifyListeners();
        } else {
          throw error; // Re-throw per errori non di rete
        }
      }
    }

    // Modalità offline
    console.log(`[Offline] Esecuzione offline: ${action.type}`);
    
    const offlineAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: action.maxRetries || 3
    };

    // Salva per sincronizzazione futura
    this.state.pendingActions.push(offlineAction);
    this.persistState();
    this.notifyListeners();

    // Esegui handler offline se disponibile
    if (offlineHandler) {
      return offlineHandler(action.data);
    }

    // Fallback generico
    return this.getOfflineFallback<T>(offlineAction);
  }

  // Determina se l'errore è di rete
  private isNetworkError(error: any): boolean {
    return error instanceof TypeError && error.message === 'Failed to fetch' ||
           error.name === 'NetworkError' ||
           error.code === 'NETWORK_ERROR';
  }

  // Fallback generico per azioni offline
  private getOfflineFallback<T>(action: OfflineAction): T {
    switch (action.type) {
      case 'CREATE_ORDER':
        return {
          success: true,
          offline: true,
          id: `offline_${Date.now()}`,
          message: 'Ordine salvato offline - verrà sincronizzato alla riconnessione'
        } as T;

      case 'UPDATE_ORDER':
        return {
          success: true,
          offline: true,
          message: 'Aggiornamento salvato offline'
        } as T;

      case 'PROCESS_PAYMENT':
        return {
          success: true,
          offline: true,
          message: 'Pagamento registrato offline - richiederà conferma online'
        } as T;

      default:
        return {
          success: true,
          offline: true,
          message: 'Azione eseguita in modalità offline'
        } as T;
    }
  }

  // Rimuovi azione in sospeso
  private removePendingAction(type: string, data: any) {
    this.state.pendingActions = this.state.pendingActions.filter(action => 
      !(action.type === type && JSON.stringify(action.data) === JSON.stringify(data))
    );
    this.persistState();
  }

  // Sincronizza azioni in sospeso
  async syncPendingActions(): Promise<void> {
    if (!this.state.isOnline || this.state.syncInProgress || this.state.pendingActions.length === 0) {
      return;
    }

    console.log(`[Offline] Inizio sincronizzazione ${this.state.pendingActions.length} azioni`);
    this.state.syncInProgress = true;
    this.notifyListeners();

    const actionsToSync = [...this.state.pendingActions];
    const syncResults = {
      successful: 0,
      failed: 0,
      conflicts: 0
    };

    for (const action of actionsToSync) {
      try {
        await this.syncSingleAction(action);
        
        // Rimuovi azione sincronizzata
        this.state.pendingActions = this.state.pendingActions.filter(a => a.id !== action.id);
        syncResults.successful++;
        
      } catch (error) {
        console.error(`[Offline] Errore sincronizzazione azione ${action.id}:`, error);
        
        // Incrementa contatore retry
        action.retryCount++;
        
        if (action.retryCount >= action.maxRetries) {
          // Rimuovi azione fallita dopo max retry
          this.state.pendingActions = this.state.pendingActions.filter(a => a.id !== action.id);
          
          if (action.critical) {
            // Salva conflitto per azioni critiche
            this.state.conflicts.push({
              action,
              error: error instanceof Error ? error.message : 'Errore sconosciuto',
              timestamp: new Date()
            });
            syncResults.conflicts++;
          }
          
          syncResults.failed++;
        }
      }
    }

    this.state.syncInProgress = false;
    this.persistState();
    this.notifyListeners();
    
    console.log(`[Offline] Sincronizzazione completata:`, syncResults);
  }

  // Sincronizza singola azione
  private async syncSingleAction(action: OfflineAction): Promise<void> {
    const endpoint = this.getEndpointForAction(action);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...action.data,
        _offline_sync: true,
        _original_timestamp: action.timestamp
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Controlla conflitti
    if (result.conflict) {
      throw new Error('Conflitto di sincronizzazione rilevato');
    }
  }

  // Ottieni endpoint per tipo azione
  private getEndpointForAction(action: OfflineAction): string {
    switch (action.type) {
      case 'CREATE_ORDER':
        return '/api/orders';
      case 'UPDATE_ORDER':
        return `/api/orders/${action.data.id}`;
      case 'PROCESS_PAYMENT':
        return '/api/payments';
      case 'UPDATE_STATUS':
        return `/api/orders/${action.data.id}/status`;
      default:
        throw new Error(`Endpoint non definito per azione ${action.type}`);
    }
  }

  // Timer automatico per sync
  private startSyncTimer() {
    this.syncTimer = setInterval(() => {
      if (this.state.isOnline && this.state.pendingActions.length > 0) {
        this.syncPendingActions();
      }
    }, 30000); // Ogni 30 secondi
  }

  // Ottieni dati cached per visualizzazione offline
  async getOfflineData<T>(key: string, fallback?: T): Promise<T | null> {
    const cached = globalCache.get<T>(key);
    if (cached) {
      console.log(`[Offline] Dati cached trovati per ${key}`);
      return cached;
    }

    if (fallback !== undefined) {
      console.log(`[Offline] Usando fallback per ${key}`);
      return fallback;
    }

    console.log(`[Offline] Nessun dato disponibile per ${key}`);
    return null;
  }

  // Salva dati per uso offline futuro
  cacheForOffline<T>(key: string, data: T, ttl: number = 300000): void {
    globalCache.set(key, data, {
      ttl,
      tags: ['offline_cache'],
      priority: 'high'
    });
    console.log(`[Offline] Dati cached per uso offline: ${key}`);
  }

  // Ottieni stato corrente
  getState(): OfflineState {
    return { ...this.state };
  }

  // Pulisci conflitti risolti
  clearConflicts(): void {
    this.state.conflicts = [];
    this.persistState();
    this.notifyListeners();
  }

  // Retry manuale azione fallita
  async retryFailedAction(actionId: string): Promise<boolean> {
    const action = this.state.pendingActions.find(a => a.id === actionId);
    if (!action) return false;

    try {
      await this.syncSingleAction(action);
      this.state.pendingActions = this.state.pendingActions.filter(a => a.id !== actionId);
      this.persistState();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error(`[Offline] Retry fallito per azione ${actionId}:`, error);
      return false;
    }
  }

  // Distruggi manager
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    window.removeEventListener('online', this.initializeNetworkListeners);
    window.removeEventListener('offline', this.initializeNetworkListeners);
  }
}

// Istanza globale
export const offlineManager = new OfflineManager();

// Hook React per uso nei componenti
export function useOfflineManager() {
  const [state, setState] = useState<OfflineState>(offlineManager.getState());

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
    executeAction: offlineManager.executeAction.bind(offlineManager),
    syncPendingActions: offlineManager.syncPendingActions.bind(offlineManager),
    getOfflineData: offlineManager.getOfflineData.bind(offlineManager),
    cacheForOffline: offlineManager.cacheForOffline.bind(offlineManager),
    clearConflicts: offlineManager.clearConflicts.bind(offlineManager),
    retryFailedAction: offlineManager.retryFailedAction.bind(offlineManager)
  };
}