import { z } from 'zod';

// Schema base per importi monetari
const MoneySchema = z.number()
  .min(0.01, 'L\'importo deve essere maggiore di zero')
  .max(99999.99, 'Importo troppo elevato')
  .refine(val => Number(val.toFixed(2)) === val, 'L\'importo può avere massimo 2 decimali');

// Schema per modalità pagamento
export const PaymentMethodSchema = z.enum(['POS', 'CONTANTI', 'MISTO'], {
  errorMap: () => ({ message: 'Modalità pagamento non valida' })
});

// Schema per creazione pagamento
export const CreatePaymentSchema = z.object({
  ordinazioneId: z.string().uuid('ID ordinazione non valido'),
  modalita: PaymentMethodSchema,
  importo: MoneySchema,
  clienteNome: z.string()
    .min(2, 'Nome cliente troppo corto')
    .max(100, 'Nome cliente troppo lungo')
    .optional()
});

// Schema per pagamento parziale
export const PartialPaymentSchema = z.object({
  clienteNome: z.string()
    .min(2, 'Nome cliente troppo corto')
    .max(100, 'Nome cliente troppo lungo'),
  importo: MoneySchema,
  modalita: PaymentMethodSchema,
  righeSelezionate: z.array(z.string().uuid()).min(1, 'Seleziona almeno un articolo'),
  quantitaPerRiga: z.record(z.string(), z.number().int().positive()).optional()
});

// Schema per creazione debito
export const CreateDebtSchema = z.object({
  clienteId: z.string().uuid('ID cliente non valido'),
  ordinazioneId: z.string().uuid('ID ordinazione non valido').optional(),
  importo: MoneySchema,
  note: z.string().max(500, 'Note troppo lunghe').optional()
});

// Schema per pagamento debito
export const PayDebtSchema = z.object({
  debitoId: z.string().uuid('ID debito non valido'),
  importo: MoneySchema,
  modalita: PaymentMethodSchema,
  note: z.string().max(500, 'Note troppo lunghe').optional()
});

// Schema per richiesta scontrino
export const ReceiptRequestSchema = z.object({
  items: z.array(z.object({
    orderId: z.string().uuid(),
    totalPrice: MoneySchema
  })).min(1, 'Nessun ordine selezionato'),
  totalAmount: MoneySchema,
  paymentMethod: PaymentMethodSchema,
  waiterName: z.string().min(2, 'Nome cameriere richiesto')
});

// Schema per pagamento multi-ordine
export const MultiOrderPaymentSchema = z.object({
  payments: z.array(z.object({
    orderId: z.string().uuid(),
    importo: MoneySchema,
    items: z.array(z.object({
      id: z.string().uuid(),
      quantita: z.number().int().positive()
    }))
  })).min(1, 'Nessun pagamento configurato'),
  clienteNome: z.string().min(2, 'Nome cliente richiesto'),
  modalita: PaymentMethodSchema
});

// Validatore helper con error handling
export function validatePaymentData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return {
      success: false,
      errors: ['Errore di validazione sconosciuto']
    };
  }
}

// Hook per validazione in React components
import { useState, useCallback } from 'react';

export function usePaymentValidation<T>(schema: z.ZodSchema<T>) {
  const [errors, setErrors] = useState<string[]>([]);
  
  const validate = useCallback((data: unknown): data is T => {
    const result = validatePaymentData(schema, data);
    if (result.success) {
      setErrors([]);
      return true;
    } else {
      setErrors(result.errors);
      return false;
    }
  }, [schema]);
  
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);
  
  return {
    validate,
    errors,
    clearErrors,
    hasErrors: errors.length > 0
  };
}