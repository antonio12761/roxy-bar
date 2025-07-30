"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { auditService } from "./audit-service";
import { notificationManager } from "@/lib/notifications/NotificationManager";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  correctedAmount?: number;
  metadata: {
    calculatedTotal: number;
    paidTotal: number;
    difference: number;
    validationTime: number;
    rulesPassed: number;
    rulesTotal: number;
  };
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  field?: string;
  expectedValue?: any;
  actualValue?: any;
  suggestedFix?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  recommendation?: string;
}

export interface PaymentValidationConfig {
  tolerance: number; // Tolleranza in centesimi
  enableAutoCorrection: boolean;
  enableRealTimeValidation: boolean;
  alertThreshold: number; // Soglia in euro per alert
  enableAuditLogging: boolean;
  validationRules: {
    checkTotalConsistency: boolean;
    checkItemPricing: boolean;
    checkPaymentMethods: boolean;
    checkDiscounts: boolean;
    checkTaxCalculation: boolean;
    checkRounding: boolean;
  };
}

export class PaymentValidationService {
  private config: PaymentValidationConfig = {
    tolerance: 2, // 2 centesimi
    enableAutoCorrection: false,
    enableRealTimeValidation: true,
    alertThreshold: 10, // 10 euro
    enableAuditLogging: true,
    validationRules: {
      checkTotalConsistency: true,
      checkItemPricing: true,
      checkPaymentMethods: true,
      checkDiscounts: true,
      checkTaxCalculation: true,
      checkRounding: true
    }
  };

  constructor(config?: Partial<PaymentValidationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Validazione completa di un'ordinazione
  async validateOrderPayment(ordinazioneId: string, userId: string, sessionId: string): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Validator] Inizio validazione ordinazione ${ordinazioneId}`);
      
      const ordinazione = await this.loadOrderWithDetails(ordinazioneId);
      if (!ordinazione) {
        return this.createErrorResult('ORDER_NOT_FOUND', 'Ordinazione non trovata');
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      let rulesPassed = 0;
      const rulesTotal = Object.values(this.config.validationRules).filter(Boolean).length;

      // Calcola totale teorico
      const calculatedTotal = this.calculateOrderTotal(ordinazione);
      const paidTotal = this.calculatePaidTotal(ordinazione);
      const difference = Math.abs(calculatedTotal - paidTotal);

      console.log(`[Validator] Ordinazione ${ordinazioneId}: Calcolato €${calculatedTotal.toFixed(2)}, Pagato €${paidTotal.toFixed(2)}, Differenza €${difference.toFixed(2)}`);

      // Regola 1: Coerenza totale
      if (this.config.validationRules.checkTotalConsistency) {
        const totalError = this.validateTotalConsistency(calculatedTotal, paidTotal);
        if (totalError) {
          errors.push(totalError);
        } else {
          rulesPassed++;
        }
      }

      // Regola 2: Prezzi prodotti
      if (this.config.validationRules.checkItemPricing) {
        const pricingErrors = await this.validateItemPricing(ordinazione);
        errors.push(...pricingErrors);
        if (pricingErrors.length === 0) rulesPassed++;
      }

      // Regola 3: Modalità pagamento
      if (this.config.validationRules.checkPaymentMethods) {
        const paymentErrors = this.validatePaymentMethods(ordinazione);
        errors.push(...paymentErrors);
        if (paymentErrors.length === 0) rulesPassed++;
      }

      // Regola 4: Sconti
      if (this.config.validationRules.checkDiscounts) {
        const discountErrors = this.validateDiscounts(ordinazione);
        errors.push(...discountErrors);
        warnings.push(...this.validateDiscountWarnings(ordinazione));
        if (discountErrors.length === 0) rulesPassed++;
      }

      // Regola 5: Calcolo tasse (se applicabile)
      if (this.config.validationRules.checkTaxCalculation) {
        const taxErrors = this.validateTaxCalculation(ordinazione);
        errors.push(...taxErrors);
        if (taxErrors.length === 0) rulesPassed++;
      }

      // Regola 6: Arrotondamenti
      if (this.config.validationRules.checkRounding) {
        const roundingWarnings = this.validateRounding(calculatedTotal, paidTotal);
        warnings.push(...roundingWarnings);
        rulesPassed++; // Gli arrotondamenti generano solo warning
      }

      const validationTime = Date.now() - startTime;
      const isValid = errors.length === 0;

      const result: ValidationResult = {
        isValid,
        errors,
        warnings,
        correctedAmount: isValid ? undefined : calculatedTotal,
        metadata: {
          calculatedTotal,
          paidTotal,
          difference,
          validationTime,
          rulesPassed,
          rulesTotal
        }
      };

      // Audit logging
      if (this.config.enableAuditLogging) {
        await this.logValidationResult(ordinazioneId, userId, sessionId, result);
      }

      // Notifica per errori critici
      if (errors.some(e => e.severity === 'CRITICAL') || difference > this.config.alertThreshold) {
        await this.notifyCriticalValidationError(ordinazioneId, result, userId);
      }

      console.log(`[Validator] Validazione completata in ${validationTime}ms: ${isValid ? 'VALIDA' : 'ERRORI'} (${rulesPassed}/${rulesTotal} regole)`);
      
      return result;

    } catch (error) {
      console.error(`[Validator] Errore validazione ${ordinazioneId}:`, error);
      return this.createErrorResult('VALIDATION_FAILED', 'Errore durante la validazione', 'CRITICAL');
    }
  }

  // Validazione in tempo reale durante il pagamento
  async validatePaymentInProgress(
    ordinazioneId: string,
    currentPayments: { modalita: string; importo: number }[],
    userId: string
  ): Promise<{
    canProceed: boolean;
    remainingAmount: number;
    overpayment: number;
    warnings: ValidationWarning[];
  }> {
    try {
      const ordinazione = await this.loadOrderWithDetails(ordinazioneId);
      if (!ordinazione) {
        return {
          canProceed: false,
          remainingAmount: 0,
          overpayment: 0,
          warnings: [{ code: 'ORDER_NOT_FOUND', message: 'Ordinazione non trovata' }]
        };
      }

      const calculatedTotal = this.calculateOrderTotal(ordinazione);
      const existingPayments = this.calculatePaidTotal(ordinazione);
      const currentPaymentTotal = currentPayments.reduce((sum, p) => sum + p.importo, 0);
      const totalPaid = existingPayments + currentPaymentTotal;
      
      const remainingAmount = Math.max(0, calculatedTotal - totalPaid);
      const overpayment = Math.max(0, totalPaid - calculatedTotal);
      
      const warnings: ValidationWarning[] = [];
      
      if (overpayment > this.config.tolerance / 100) {
        warnings.push({
          code: 'OVERPAYMENT_DETECTED',
          message: `Pagamento eccedente di €${overpayment.toFixed(2)}`,
          recommendation: 'Verificare l\'importo prima di confermare'
        });
      }
      
      if (remainingAmount < 0.01 && remainingAmount > 0) {
        warnings.push({
          code: 'SMALL_REMAINDER',
          message: `Residuo minimo di €${remainingAmount.toFixed(2)}`,
          recommendation: 'Considerare arrotondamento'
        });
      }

      return {
        canProceed: overpayment <= this.config.alertThreshold,
        remainingAmount,
        overpayment,
        warnings
      };

    } catch (error) {
      console.error('[Validator] Errore validazione pagamento in corso:', error);
      return {
        canProceed: false,
        remainingAmount: 0,
        overpayment: 0,
        warnings: [{ code: 'VALIDATION_ERROR', message: 'Errore durante la validazione' }]
      };
    }
  }

  // Carica ordinazione con tutti i dettagli necessari
  private async loadOrderWithDetails(ordinazioneId: string) {
    return await prisma.ordinazione.findUnique({
      where: { id: ordinazioneId },
      include: {
        righe: {
          include: {
            prodotto: {
              select: {
                prezzo: true,
                nome: true
              }
            }
          }
        },
        pagamenti: true,
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
    });
  }

  // Calcola il totale teorico dell'ordinazione
  private calculateOrderTotal(ordinazione: any): number {
    let total = 0;
    
    for (const riga of ordinazione.righe) {
      if (!riga.isDeleted && !riga.isPagato) {
        const prezzoUnitario = riga.prezzo?.toNumber() || riga.prodotto?.prezzo?.toNumber() || 0;
        total += prezzoUnitario * riga.quantita;
      }
    }
    
    return Math.round(total * 100) / 100; // Arrotonda a 2 decimali
  }

  // Calcola il totale già pagato
  private calculatePaidTotal(ordinazione: any): number {
    let total = 0;
    
    for (const pagamento of ordinazione.pagamenti) {
      total += pagamento.importo?.toNumber() || 0;
    }
    
    return Math.round(total * 100) / 100;
  }

  // Valida coerenza del totale
  private validateTotalConsistency(calculated: number, paid: number): ValidationError | null {
    const difference = Math.abs(calculated - paid);
    const toleranceEuro = this.config.tolerance / 100;
    
    if (difference > toleranceEuro) {
      const severity = difference > this.config.alertThreshold ? 'CRITICAL' : 'HIGH';
      
      return {
        code: 'TOTAL_MISMATCH',
        message: `Importo non corrispondente: calcolato €${calculated.toFixed(2)}, pagato €${paid.toFixed(2)} (diff: €${difference.toFixed(2)})`,
        severity,
        expectedValue: calculated,
        actualValue: paid,
        suggestedFix: `Correggere l'importo pagato a €${calculated.toFixed(2)}`
      };
    }
    
    return null;
  }

  // Valida prezzi dei prodotti
  private async validateItemPricing(ordinazione: any): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    for (const riga of ordinazione.righe) {
      if (riga.isDeleted) continue;
      
      const prezzoRiga = riga.prezzo?.toNumber() || 0;
      const prezzoProdotto = riga.prodotto?.prezzo?.toNumber() || 0;
      
      // Verifica che il prezzo nella riga corrisponda al prezzo del prodotto
      if (Math.abs(prezzoRiga - prezzoProdotto) > 0.01) {
        errors.push({
          code: 'PRICE_MISMATCH',
          message: `Prezzo non corrispondente per ${riga.prodotto.nome}: €${prezzoRiga.toFixed(2)} vs €${prezzoProdotto.toFixed(2)}`,
          severity: 'MEDIUM',
          field: `riga_${riga.id}`,
          expectedValue: prezzoProdotto,
          actualValue: prezzoRiga,
          suggestedFix: `Aggiornare prezzo riga a €${prezzoProdotto.toFixed(2)}`
        });
      }
      
      // Verifica quantità logiche
      if (riga.quantita <= 0) {
        errors.push({
          code: 'INVALID_QUANTITY',
          message: `Quantità non valida per ${riga.prodotto.nome}: ${riga.quantita}`,
          severity: 'HIGH',
          field: `riga_${riga.id}`,
          suggestedFix: 'Correggere o rimuovere la riga'
        });
      }
    }
    
    return errors;
  }

  // Valida modalità di pagamento
  private validatePaymentMethods(ordinazione: any): ValidationError[] {
    const errors: ValidationError[] = [];
    const validMethods = ['CONTANTI', 'CARTA', 'SATISPAY', 'BONIFICO'];
    
    for (const pagamento of ordinazione.pagamenti) {
      if (!validMethods.includes(pagamento.modalita)) {
        errors.push({
          code: 'INVALID_PAYMENT_METHOD',
          message: `Modalità di pagamento non valida: ${pagamento.modalita}`,
          severity: 'MEDIUM',
          field: `pagamento_${pagamento.id}`,
          suggestedFix: `Utilizzare una modalità valida: ${validMethods.join(', ')}`
        });
      }
      
      if (pagamento.importo?.toNumber() <= 0) {
        errors.push({
          code: 'INVALID_PAYMENT_AMOUNT',
          message: `Importo pagamento non valido: €${pagamento.importo?.toNumber() || 0}`,
          severity: 'HIGH',
          field: `pagamento_${pagamento.id}`,
          suggestedFix: 'Correggere l\'importo del pagamento'
        });
      }
    }
    
    return errors;
  }

  // Valida sconti applicati
  private validateDiscounts(ordinazione: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Per ora implementazione base - può essere estesa
    for (const riga of ordinazione.righe) {
      if (riga.sconto && riga.sconto > 0.5) { // Sconto > 50%
        errors.push({
          code: 'EXCESSIVE_DISCOUNT',
          message: `Sconto eccessivo per ${riga.prodotto?.nome}: ${(riga.sconto * 100).toFixed(1)}%`,
          severity: 'MEDIUM',
          field: `riga_${riga.id}`,
          suggestedFix: 'Verificare autorizzazione per lo sconto'
        });
      }
    }
    
    return errors;
  }

  // Warning per sconti
  private validateDiscountWarnings(ordinazione: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    
    const totalDiscount = ordinazione.righe.reduce((sum: number, riga: any) => {
      if (riga.sconto) {
        const originalPrice = (riga.prodotto?.prezzo?.toNumber() || 0) * riga.quantita;
        return sum + (originalPrice * riga.sconto);
      }
      return sum;
    }, 0);
    
    if (totalDiscount > 20) {
      warnings.push({
        code: 'HIGH_TOTAL_DISCOUNT',
        message: `Sconto totale elevato: €${totalDiscount.toFixed(2)}`,
        recommendation: 'Verificare autorizzazione per sconti multipli'
      });
    }
    
    return warnings;
  }

  // Valida calcolo tasse (placeholder per future implementazioni)
  private validateTaxCalculation(ordinazione: any): ValidationError[] {
    // Per ora non abbiamo gestione IVA, ma preparato per futuro
    return [];
  }

  // Valida arrotondamenti
  private validateRounding(calculated: number, paid: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const difference = paid - calculated;
    
    if (Math.abs(difference) > 0 && Math.abs(difference) <= 0.02) {
      warnings.push({
        code: 'ROUNDING_APPLIED',
        message: `Arrotondamento applicato: ${difference > 0 ? '+' : ''}€${difference.toFixed(2)}`,
        recommendation: 'Arrotondamento entro tolleranza'
      });
    }
    
    return warnings;
  }

  // Crea risultato di errore
  private createErrorResult(code: string, message: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH'): ValidationResult {
    return {
      isValid: false,
      errors: [{
        code,
        message,
        severity
      }],
      warnings: [],
      metadata: {
        calculatedTotal: 0,
        paidTotal: 0,
        difference: 0,
        validationTime: 0,
        rulesPassed: 0,
        rulesTotal: 0
      }
    };
  }

  // Log risultato validazione
  private async logValidationResult(
    ordinazioneId: string,
    userId: string,
    sessionId: string,
    result: ValidationResult
  ): Promise<void> {
    try {
      await auditService.createAuditLog({
        entityType: 'ORDINAZIONE',
        entityId: ordinazioneId,
        action: 'VALIDATE',
        userId,
        sessionId,
        metadata: {
          validation: {
            isValid: result.isValid,
            errorCount: result.errors.length,
            warningCount: result.warnings.length,
            ...result.metadata
          }
        },
        severity: result.isValid ? 'LOW' : (result.errors.some(e => e.severity === 'CRITICAL') ? 'HIGH' : 'MEDIUM'),
        category: 'PAYMENT',
        success: result.isValid,
        errorMessage: result.errors.length > 0 ? result.errors[0].message : undefined
      });

    } catch (error) {
      console.error('[Validator] Errore log audit:', error);
    }
  }

  // Notifica errori critici
  private async notifyCriticalValidationError(
    ordinazioneId: string,
    result: ValidationResult,
    userId: string
  ): Promise<void> {
    try {
      const managers = await prisma.user.findMany({
        where: {
          ruolo: { in: ['MANAGER', 'SUPERVISORE', 'ADMIN'] },
          attivo: true
        },
        select: { id: true, nome: true }
      });

      // TODO: Implementare notifica errori validazione pagamento
      // for (const manager of managers) {
      //   await notificationManager.notifyPaymentValidationError({
      //     managerId: manager.id,
      //     ordinazioneId,
      //     userId,
      //     errors: result.errors.filter(e => e.severity === 'CRITICAL'),
      //     difference: result.metadata.difference
      //   });
      // }

    } catch (error) {
      console.error('[Validator] Errore notifica critica:', error);
    }
  }

  // Correzione automatica (se abilitata)
  async attemptAutoCorrection(
    ordinazioneId: string,
    validationResult: ValidationResult,
    userId: string,
    sessionId: string
  ): Promise<{
    corrected: boolean;
    changes: string[];
    newValidation?: ValidationResult;
  }> {
    if (!this.config.enableAutoCorrection) {
      return { corrected: false, changes: [] };
    }

    const changes: string[] = [];

    try {
      console.log(`[Validator] Tentativo correzione automatica per ${ordinazioneId}`);
      
      // Implementa correzioni automatiche per errori specifici
      for (const error of validationResult.errors) {
        switch (error.code) {
          case 'PRICE_MISMATCH':
            // Aggiorna prezzo riga al prezzo prodotto attuale
            if (error.field && error.expectedValue) {
              const rigaId = error.field.replace('riga_', '');
              await prisma.rigaOrdinazione.update({
                where: { id: rigaId },
                data: { prezzo: new Decimal(error.expectedValue) }
              });
              changes.push(`Aggiornato prezzo riga a €${error.expectedValue}`);
            }
            break;
            
          // Altri tipi di correzione possono essere aggiunti qui
        }
      }

      if (changes.length > 0) {
        // Ri-valida dopo le correzioni
        const newValidation = await this.validateOrderPayment(ordinazioneId, userId, sessionId);
        
        console.log(`[Validator] Correzione automatica completata: ${changes.length} modifiche`);
        
        return {
          corrected: true,
          changes,
          newValidation
        };
      }

      return { corrected: false, changes: [] };

    } catch (error) {
      console.error('[Validator] Errore correzione automatica:', error);
      return { corrected: false, changes: [] };
    }
  }

  // Statistiche validazione
  async getValidationStats(days: number = 30): Promise<{
    totalValidations: number;
    successRate: number;
    avgValidationTime: number;
    commonErrors: Array<{ code: string; count: number; message: string }>;
    avgDifference: number;
    criticalValidations: number;
  }> {
    try {
      // Questa implementazione richiede che gli audit log includano dati di validazione
      // Per ora restituiamo dati mock - da implementare quando gli audit log sono popolati
      return {
        totalValidations: 0,
        successRate: 0,
        avgValidationTime: 0,
        commonErrors: [],
        avgDifference: 0,
        criticalValidations: 0
      };
      
    } catch (error) {
      console.error('[Validator] Errore statistiche:', error);
      throw error;
    }
  }

  // Aggiorna configurazione
  updateConfig(newConfig: Partial<PaymentValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[Validator] Configurazione aggiornata:', this.config);
  }

  // Ottieni configurazione
  getConfig(): PaymentValidationConfig {
    return { ...this.config };
  }
}

// Istanza globale
export const paymentValidator = new PaymentValidationService();

// Funzione helper per validazione rapida
export async function validateOrderPaymentQuick(
  ordinazioneId: string,
  userId: string,
  sessionId: string
): Promise<{ isValid: boolean; difference: number; errors: string[] }> {
  try {
    const result = await paymentValidator.validateOrderPayment(ordinazioneId, userId, sessionId);
    
    return {
      isValid: result.isValid,
      difference: result.metadata.difference,
      errors: result.errors.map(e => e.message)
    };
    
  } catch (error) {
    return {
      isValid: false,
      difference: 0,
      errors: ['Errore durante la validazione']
    };
  }
}

// Middleware per validazione automatica
export function createValidationMiddleware() {
  return async (req: any, res: any, next: any) => {
    // Intercetta richieste di pagamento per validazione automatica
    if (req.path.includes('/pagamenti') && req.method === 'POST') {
      const { ordinazioneId } = req.body;
      const userId = req.user?.id;
      const sessionId = req.session?.id;
      
      if (ordinazioneId && userId && sessionId) {
        try {
          const validation = await paymentValidator.validateOrderPayment(ordinazioneId, userId, sessionId);
          
          // Allega risultato validazione alla response
          res.locals.validation = validation;
          
          // Blocca se errori critici
          if (validation.errors.some(e => e.severity === 'CRITICAL')) {
            return res.status(400).json({
              error: 'Validazione pagamento fallita',
              validation
            });
          }
          
        } catch (error) {
          console.error('[Validator] Errore middleware validazione:', error);
        }
      }
    }
    
    next();
  };
}
