// State Machine per gestione stati ordini
export type OrderState = 
  | 'ORDINATO'
  | 'IN_PREPARAZIONE'
  | 'PRONTO'
  | 'CONSEGNATO'
  | 'RICHIESTA_CONTO'
  | 'PAGAMENTO_RICHIESTO'
  | 'PAGATO'
  | 'ANNULLATO'
  | 'ORDINATO_ESAURITO';

export type PaymentState =
  | 'NON_PAGATO'
  | 'PARZIALMENTE_PAGATO'
  | 'COMPLETAMENTE_PAGATO';

export type OrderEvent =
  | 'START_PREPARATION'
  | 'MARK_READY'
  | 'DELIVER'
  | 'REQUEST_BILL'
  | 'REQUEST_PAYMENT'
  | 'PAY'
  | 'PAY_PARTIAL'
  | 'CANCEL'
  | 'MARK_OUT_OF_STOCK';

// Definizione transizioni valide
const STATE_TRANSITIONS: Record<OrderState, Partial<Record<OrderEvent, OrderState>>> = {
  ORDINATO: {
    START_PREPARATION: 'IN_PREPARAZIONE',
    CANCEL: 'ANNULLATO',
    MARK_OUT_OF_STOCK: 'ORDINATO_ESAURITO'
  },
  IN_PREPARAZIONE: {
    MARK_READY: 'PRONTO',
    CANCEL: 'ANNULLATO'
  },
  PRONTO: {
    DELIVER: 'CONSEGNATO',
    CANCEL: 'ANNULLATO'
  },
  CONSEGNATO: {
    REQUEST_BILL: 'RICHIESTA_CONTO',
    REQUEST_PAYMENT: 'PAGAMENTO_RICHIESTO',
    PAY: 'PAGATO',
    PAY_PARTIAL: 'CONSEGNATO' // Rimane CONSEGNATO se parzialmente pagato
  },
  RICHIESTA_CONTO: {
    REQUEST_PAYMENT: 'PAGAMENTO_RICHIESTO',
    PAY: 'PAGATO',
    PAY_PARTIAL: 'RICHIESTA_CONTO'
  },
  PAGAMENTO_RICHIESTO: {
    PAY: 'PAGATO',
    PAY_PARTIAL: 'PAGAMENTO_RICHIESTO'
  },
  PAGATO: {
    // Nessuna transizione permessa da PAGATO
  },
  ANNULLATO: {
    // Nessuna transizione permessa da ANNULLATO
  },
  ORDINATO_ESAURITO: {
    START_PREPARATION: 'IN_PREPARAZIONE',
    CANCEL: 'ANNULLATO'
  }
};

// Transizioni valide per stato pagamento
const PAYMENT_STATE_TRANSITIONS: Record<PaymentState, Partial<Record<OrderEvent, PaymentState>>> = {
  NON_PAGATO: {
    PAY: 'COMPLETAMENTE_PAGATO',
    PAY_PARTIAL: 'PARZIALMENTE_PAGATO'
  },
  PARZIALMENTE_PAGATO: {
    PAY: 'COMPLETAMENTE_PAGATO',
    PAY_PARTIAL: 'PARZIALMENTE_PAGATO'
  },
  COMPLETAMENTE_PAGATO: {
    // Nessuna transizione permessa
  }
};

// Classe State Machine
export class OrderStateMachine {
  private currentState: OrderState;
  private paymentState: PaymentState;
  private history: Array<{ state: OrderState; paymentState: PaymentState; event: OrderEvent; timestamp: Date }> = [];

  constructor(initialState: OrderState = 'ORDINATO', initialPaymentState: PaymentState = 'NON_PAGATO') {
    this.currentState = initialState;
    this.paymentState = initialPaymentState;
  }

  // Verifica se una transizione è valida
  canTransition(event: OrderEvent): boolean {
    const possibleNextState = STATE_TRANSITIONS[this.currentState]?.[event];
    return possibleNextState !== undefined;
  }

  // Esegue transizione se valida
  transition(event: OrderEvent): { success: boolean; newState?: OrderState; newPaymentState?: PaymentState; error?: string } {
    const nextState = STATE_TRANSITIONS[this.currentState]?.[event];
    const nextPaymentState = PAYMENT_STATE_TRANSITIONS[this.paymentState]?.[event];

    if (!nextState && !nextPaymentState) {
      return {
        success: false,
        error: `Transizione non valida: ${this.currentState} -> ${event}`
      };
    }

    // Salva nella history
    this.history.push({
      state: this.currentState,
      paymentState: this.paymentState,
      event,
      timestamp: new Date()
    });

    // Applica transizioni
    if (nextState) {
      this.currentState = nextState;
    }
    if (nextPaymentState) {
      this.paymentState = nextPaymentState;
    }

    // Sincronizza stati speciali
    if (event === 'PAY' && nextPaymentState === 'COMPLETAMENTE_PAGATO') {
      this.currentState = 'PAGATO';
    }

    return {
      success: true,
      newState: this.currentState,
      newPaymentState: this.paymentState
    };
  }

  // Ottieni stato corrente
  getState(): { orderState: OrderState; paymentState: PaymentState } {
    return {
      orderState: this.currentState,
      paymentState: this.paymentState
    };
  }

  // Ottieni storia transizioni
  getHistory() {
    return [...this.history];
  }

  // Rollback all'ultimo stato (per optimistic UI)
  rollback(): boolean {
    if (this.history.length === 0) {
      return false;
    }

    const lastState = this.history.pop();
    if (lastState) {
      this.currentState = lastState.state;
      this.paymentState = lastState.paymentState;
      return true;
    }
    return false;
  }

  // Verifica consistenza stati
  isConsistent(): boolean {
    // PAGATO deve sempre avere COMPLETAMENTE_PAGATO
    if (this.currentState === 'PAGATO' && this.paymentState !== 'COMPLETAMENTE_PAGATO') {
      return false;
    }
    
    // COMPLETAMENTE_PAGATO deve sempre avere PAGATO
    if (this.paymentState === 'COMPLETAMENTE_PAGATO' && this.currentState !== 'PAGATO') {
      return false;
    }

    // Stati pre-consegna non possono essere pagati
    if (['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO'].includes(this.currentState) && 
        this.paymentState !== 'NON_PAGATO') {
      return false;
    }

    return true;
  }
}

// Factory per creare state machine da ordine esistente
export function createStateMachineFromOrder(order: {
  stato: string;
  statoPagamento: string;
}): OrderStateMachine {
  return new OrderStateMachine(
    order.stato as OrderState,
    order.statoPagamento as PaymentState
  );
}

// Validatore transizioni batch
export function validateBatchTransitions(
  orders: Array<{ id: string; stato: string; statoPagamento: string }>,
  event: OrderEvent
): {
  valid: Array<{ id: string; newState: OrderState; newPaymentState: PaymentState }>;
  invalid: Array<{ id: string; error: string }>;
} {
  const valid = [];
  const invalid = [];

  for (const order of orders) {
    const sm = createStateMachineFromOrder(order);
    const result = sm.transition(event);

    if (result.success && result.newState && result.newPaymentState) {
      valid.push({
        id: order.id,
        newState: result.newState,
        newPaymentState: result.newPaymentState
      });
    } else {
      invalid.push({
        id: order.id,
        error: result.error || 'Transizione non valida'
      });
    }
  }

  return { valid, invalid };
}

// Helper per determinare eventi disponibili per uno stato
export function getAvailableEvents(state: OrderState, paymentState: PaymentState): OrderEvent[] {
  const orderEvents = Object.keys(STATE_TRANSITIONS[state] || {}) as OrderEvent[];
  const paymentEvents = Object.keys(PAYMENT_STATE_TRANSITIONS[paymentState] || {}) as OrderEvent[];
  
  // Unisci e deduplica
  const allEvents = new Set([...orderEvents, ...paymentEvents]);
  return Array.from(allEvents);
}