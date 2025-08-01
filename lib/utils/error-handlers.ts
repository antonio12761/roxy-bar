import { TransizioneStatoError } from "@/lib/middleware/state-validation";
import { toast } from "@/lib/toast";

// Tipo per il risultato delle operazioni
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statoAttuale?: string;
  transizioniPermesse?: string[];
}

// Handler globale per errori di transizione stato
export function handleStateTransitionError(error: any): OperationResult {
  if (error.name === 'TransizioneStatoError' || error instanceof TransizioneStatoError) {
    // Mostra un toast con l'errore
    toast.error(
      `Transizione non permessa: ${error.message}`,
      {
        duration: 5000,
        position: 'top-center'
      }
    );
    
    return {
      success: false,
      error: error.message,
      statoAttuale: error.statoAttuale,
      transizioniPermesse: error.transizioniPermesse
    };
  }
  
  // Altri errori
  console.error('Errore non gestito:', error);
  toast.error('Si è verificato un errore imprevisto');
  
  return {
    success: false,
    error: error.message || 'Errore sconosciuto'
  };
}

// Wrapper per operazioni che possono generare errori di transizione
export async function withStateTransitionHandling<T>(
  operation: () => Promise<T>
): Promise<OperationResult<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    return handleStateTransitionError(error);
  }
}

// Hook per gestire errori di transizione in componenti React
export function createStateTransitionHandler(
  onError?: (error: TransizioneStatoError) => void
) {
  return (error: any) => {
    if (error.name === 'TransizioneStatoError') {
      // Log per debugging
      console.error('Errore transizione stato:', {
        statoAttuale: error.statoAttuale,
        nuovoStato: error.nuovoStato,
        entita: error.entita,
        id: error.id
      });
      
      // Chiama il callback se fornito
      if (onError) {
        onError(error);
      }
      
      // Mostra toast di errore
      const message = error.transizioniPermesse?.length > 0
        ? `${error.message}. Stati permessi: ${error.transizioniPermesse.join(', ')}`
        : error.message;
        
      toast.error(message, {
        duration: 6000,
        position: 'top-center'
      });
      
      return true; // Indica che l'errore è stato gestito
    }
    
    return false; // Non è un errore di transizione
  };
}