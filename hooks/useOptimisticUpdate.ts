import { useState, useCallback, useRef } from 'react';

// Tipo per snapshot dello stato
interface StateSnapshot<T> {
  id: string;
  timestamp: number;
  originalState: T;
  optimisticState: T;
  rollbackFn?: () => void;
}

// Hook per gestire update ottimistici con rollback
export function useOptimisticUpdate<T extends { id: string }>() {
  const [snapshots] = useState<Map<string, StateSnapshot<T>>>(new Map());
  const rollbackTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Crea snapshot prima dell'update ottimistico
  const createSnapshot = useCallback((
    item: T,
    optimisticChanges: Partial<T>,
    rollbackFn?: () => void
  ): StateSnapshot<T> => {
    const snapshot: StateSnapshot<T> = {
      id: item.id,
      timestamp: Date.now(),
      originalState: { ...item },
      optimisticState: { ...item, ...optimisticChanges },
      rollbackFn
    };
    
    snapshots.set(item.id, snapshot);
    
    // Auto-cleanup dopo 30 secondi
    const timeoutId = setTimeout(() => {
      snapshots.delete(item.id);
      rollbackTimeouts.current.delete(item.id);
    }, 30000);
    
    rollbackTimeouts.current.set(item.id, timeoutId);
    
    return snapshot;
  }, [snapshots]);

  // Rollback a stato originale
  const rollback = useCallback((snapshotId: string) => {
    const snapshot = snapshots.get(snapshotId);
    if (!snapshot) {
      console.warn(`Snapshot ${snapshotId} non trovato per rollback`);
      return null;
    }

    // Esegui rollback function se fornita
    if (snapshot.rollbackFn) {
      snapshot.rollbackFn();
    }

    // Cleanup
    const timeoutId = rollbackTimeouts.current.get(snapshotId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      rollbackTimeouts.current.delete(snapshotId);
    }
    snapshots.delete(snapshotId);

    return snapshot.originalState;
  }, [snapshots]);

  // Conferma update (rimuove snapshot)
  const confirm = useCallback((snapshotId: string) => {
    const timeoutId = rollbackTimeouts.current.get(snapshotId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      rollbackTimeouts.current.delete(snapshotId);
    }
    snapshots.delete(snapshotId);
  }, [snapshots]);

  // Cleanup all
  const cleanup = useCallback(() => {
    rollbackTimeouts.current.forEach(timeout => clearTimeout(timeout));
    rollbackTimeouts.current.clear();
    snapshots.clear();
  }, [snapshots]);

  return {
    createSnapshot,
    rollback,
    confirm,
    cleanup
  };
}

// Hook specifico per ordini
interface OrderOptimisticUpdate {
  orderId: string;
  updates: {
    stato?: string;
    statoPagamento?: string;
    totalePagato?: number;
    rimanente?: number;
  };
}

export function useOptimisticOrderUpdate(
  updateOrderState: (orderId: string, updates: any) => void,
  moveOrderBetweenStates?: (orderId: string, from: string, to: string) => void
) {
  const { createSnapshot, rollback, confirm } = useOptimisticUpdate<any>();
  const pendingUpdates = useRef<Map<string, OrderOptimisticUpdate>>(new Map());

  const applyOptimisticUpdate = useCallback((
    order: any,
    updates: OrderOptimisticUpdate['updates'],
    fromState?: string,
    toState?: string
  ) => {
    // Crea snapshot
    const snapshot = createSnapshot(order, updates, () => {
      // Rollback function
      updateOrderState(order.id, snapshot.originalState);
      if (fromState && toState && moveOrderBetweenStates) {
        // Inverti il movimento
        moveOrderBetweenStates(order.id, toState, fromState);
      }
    });

    // Applica update ottimistico
    updateOrderState(order.id, updates);
    
    // Se c'è movimento tra stati
    if (fromState && toState && moveOrderBetweenStates) {
      moveOrderBetweenStates(order.id, fromState, toState);
    }

    // Traccia pending update
    pendingUpdates.current.set(order.id, {
      orderId: order.id,
      updates
    });

    return snapshot.id;
  }, [createSnapshot, updateOrderState, moveOrderBetweenStates]);

  const confirmUpdate = useCallback((snapshotId: string) => {
    confirm(snapshotId);
    pendingUpdates.current.delete(snapshotId);
  }, [confirm]);

  const rollbackUpdate = useCallback((snapshotId: string) => {
    const originalState = rollback(snapshotId);
    pendingUpdates.current.delete(snapshotId);
    return originalState;
  }, [rollback]);

  return {
    applyOptimisticUpdate,
    confirmUpdate,
    rollbackUpdate,
    hasPendingUpdates: () => pendingUpdates.current.size > 0
  };
}

// Wrapper per azioni con optimistic UI
export async function withOptimisticUpdate<T>(
  optimisticFn: () => void,
  asyncAction: () => Promise<T>,
  rollbackFn: () => void,
  options?: {
    onSuccess?: (result: T) => void;
    onError?: (error: any) => void;
    showErrorToast?: boolean;
  }
): Promise<T | null> {
  // Applica update ottimistico
  optimisticFn();

  try {
    // Esegui azione async
    const result = await asyncAction();
    
    // Success - conferma update
    if (options?.onSuccess) {
      options.onSuccess(result);
    }
    
    return result;
  } catch (error) {
    // Error - rollback
    console.error('Errore durante azione, rollback:', error);
    rollbackFn();
    
    if (options?.onError) {
      options.onError(error);
    }
    
    if (options?.showErrorToast) {
      // Mostra toast errore (assumendo che esista un sistema di toast)
      const message = error instanceof Error ? error.message : 'Operazione fallita';
      alert(message); // Sostituire con toast reale
    }
    
    return null;
  }
}