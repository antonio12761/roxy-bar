"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface ImpostazioniScontrino {
  id: string;
  nomeAttivita: string;
  indirizzo: string;
  telefono: string;
  messaggioIntestazione: string;
  messaggioRingraziamento: string;
  mostraData: boolean;
  mostraOra: boolean;
  mostraOperatore: boolean;
  mostraTavolo: boolean;
  mostraNumeroOrdine: boolean;
  mostraCliente: boolean;
  mostraDettagliProdotti: boolean;
  mostraQuantita: boolean;
  mostraPrezzoUnitario: boolean;
  mostraTotaleRiga: boolean;
  taglioAutomatico: boolean;
  carattereSeparatore: string;
  attivo: boolean;
}

/**
 * Recupera le impostazioni scontrino attive
 */
export async function getImpostazioniScontrino() {
  try {
    const user = await getCurrentUser();
    
    // Permetti lettura a CASSA per stampare con le impostazioni corrette
    if (!user || !["SUPERVISORE", "ADMIN", "CASSA", "CAMERIERE"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Recupera le impostazioni attive
    secureLog.debug("GET - Ricerca impostazioni attive nel DB...");
    let impostazioni = await prisma.impostazioniScontrino.findFirst({
      where: { attivo: true },
      orderBy: { updatedAt: "desc" }
    });

    // Se non esistono impostazioni, crea quelle di default
    if (!impostazioni) {
      secureLog.info("GET - Creazione impostazioni di default...");
      impostazioni = await prisma.impostazioniScontrino.create({
        data: {
          nomeAttivita: "Bar Roxy",
          indirizzo: "Via Example 123, Città",
          telefono: "123-456-7890",
          messaggioIntestazione: "SCONTRINO NON FISCALE",
          messaggioRingraziamento: "Grazie per la visita!",
          mostraData: true,
          mostraOra: true,
          mostraOperatore: true,
          mostraTavolo: true,
          mostraNumeroOrdine: true,
          mostraCliente: true,
          mostraDettagliProdotti: true,
          mostraQuantita: true,
          mostraPrezzoUnitario: true,
          mostraTotaleRiga: true,
          taglioAutomatico: true,
          carattereSeparatore: "-",
          attivo: true
        }
      });
    }

    return { 
      success: true, 
      data: impostazioni as ImpostazioniScontrino 
    };
  } catch (error) {
    secureLog.error("Errore nel recupero impostazioni:", error);
    return { 
      success: false, 
      error: "Errore nel recupero delle impostazioni" 
    };
  }
}

/**
 * Aggiorna le impostazioni scontrino esistenti
 */
export async function updateImpostazioniScontrino(
  id: string, 
  updateData: Partial<ImpostazioniScontrino>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.ruolo !== "SUPERVISORE" && user.ruolo !== "ADMIN")) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    if (!id) {
      return { 
        success: false, 
        error: "ID impostazioni mancante" 
      };
    }

    // Rimuovi campi che non dovrebbero essere aggiornati
    const { id: _, attivo, ...dataToUpdate } = updateData;

    // IMPORTANTE: Assicurati che rimanga attivo!
    const impostazioniAggiornate = await prisma.impostazioniScontrino.update({
      where: { id },
      data: {
        ...dataToUpdate,
        attivo: true, // FORZA sempre attivo quando si aggiorna
        modificatoDa: user.id,
        updatedAt: new Date()
      }
    });
    
    secureLog.info("PUT - Impostazioni aggiornate con successo");

    // Revalida le pagine che usano queste impostazioni
    revalidatePath('/cassa');
    revalidatePath('/supervisore/impostazioni');

    return { 
      success: true, 
      data: impostazioniAggiornate as ImpostazioniScontrino,
      message: "Impostazioni aggiornate con successo"
    };
  } catch (error) {
    secureLog.error("Errore nell'aggiornamento impostazioni:", error);
    return { 
      success: false, 
      error: "Errore nell'aggiornamento delle impostazioni" 
    };
  }
}

/**
 * Crea nuove impostazioni scontrino (disattiva quelle esistenti)
 */
export async function createImpostazioniScontrino(
  data: Omit<ImpostazioniScontrino, 'id' | 'attivo'>
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.ruolo !== "SUPERVISORE" && user.ruolo !== "ADMIN")) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Disattiva tutte le impostazioni esistenti
    await prisma.impostazioniScontrino.updateMany({
      where: { attivo: true },
      data: { attivo: false }
    });

    // Crea nuove impostazioni
    const nuoveImpostazioni = await prisma.impostazioniScontrino.create({
      data: {
        ...data,
        attivo: true,
        modificatoDa: user.id
      }
    });

    // Revalida le pagine
    revalidatePath('/cassa');
    revalidatePath('/supervisore/impostazioni');

    return { 
      success: true, 
      data: nuoveImpostazioni as ImpostazioniScontrino,
      message: "Impostazioni create con successo"
    };
  } catch (error) {
    secureLog.error("Errore nella creazione impostazioni:", error);
    return { 
      success: false, 
      error: "Errore nella creazione delle impostazioni" 
    };
  }
}

/**
 * Helper per verificare se le impostazioni sono complete
 */
export async function checkImpostazioniComplete(): Promise<boolean> {
  const result = await getImpostazioniScontrino();
  
  if (!result.success || !result.data) {
    return false;
  }
  
  const required = [
    'nomeAttivita',
    'indirizzo',
    'telefono',
    'messaggioIntestazione',
    'messaggioRingraziamento'
  ];
  
  return required.every(field => 
    result.data![field as keyof ImpostazioniScontrino]
  );
}