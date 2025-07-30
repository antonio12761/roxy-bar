"use server";

import { pulisciScontriniVecchi } from "@/lib/services/scontrino-queue";

// Job da eseguire periodicamente (es. ogni ora) per pulire i vecchi scontrini
export async function scontrinoCleanupJob() {
  try {
    console.log("[ScontrinoCleanup] Avvio pulizia scontrini vecchi...");
    
    const result = await pulisciScontriniVecchi();
    
    if (result.success) {
      console.log(`[ScontrinoCleanup] Completata: ${result.eliminati} scontrini rimossi`);
      return {
        success: true,
        eliminati: result.eliminati,
        timestamp: new Date().toISOString()
      };
    } else {
      console.error("[ScontrinoCleanup] Errore:", result.error);
      return {
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error("[ScontrinoCleanup] Errore job:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
      timestamp: new Date().toISOString()
    };
  }
}

// Funzione per verificare la salute della queue
export async function verificaSaluteQueue() {
  try {
    const { getStatisticheScontrini } = await import("@/lib/services/scontrino-queue");
    const result = await getStatisticheScontrini();
    
    if (result.success) {
      const { stats } = result;
      
      // Controlla se ci sono troppe code o errori
      const warnings = [];
      
      if (stats && stats.inCoda > 50) {
        warnings.push(`Troppi scontrini in coda: ${stats.inCoda}`);
      }
      
      if (stats && stats.errori > 10) {
        warnings.push(`Troppi errori: ${stats.errori}`);
      }
      
      if (stats && stats.inStampa > 5) {
        warnings.push(`Troppi scontrini bloccati in stampa: ${stats.inStampa}`);
      }
      
      return {
        success: true,
        healthy: warnings.length === 0,
        stats,
        warnings,
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: false,
      healthy: false,
      error: result.error,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("[HealthCheck] Errore:", error);
    return {
      success: false,
      healthy: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
      timestamp: new Date().toISOString()
    };
  }
}

// Esporta per uso in cron jobs o API routes
export { scontrinoCleanupJob as default };