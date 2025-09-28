"use server";

import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { revalidatePath } from "next/cache";

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
    console.log("GET - Ricerca impostazioni attive nel DB...");
    let impostazioni = await prisma.impostazioniScontrino.findFirst({
      where: { attivo: true },
      orderBy: { updatedAt: "desc" }
    });
    console.log("GET - Impostazioni trovate:", impostazioni ? "SI" : "NO");
    
    if (impostazioni) {
      console.log("GET - ID:", impostazioni.id);
      console.log("GET - Nome attività:", impostazioni.nomeAttivita);
      console.log("GET - Indirizzo:", impostazioni.indirizzo);
      console.log("GET - Telefono:", impostazioni.telefono);
      console.log("GET - Messaggio:", impostazioni.messaggioRingraziamento);
    }

    // Se non esistono impostazioni, crea quelle di default CON TUTTI I CAMPI
    if (!impostazioni) {
      console.log("GET - Creazione impostazioni di default...");
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
      console.log("GET - Impostazioni di default create con successo");
    }

    return serializeDecimalData({
      success: true,
      data: impostazioni
    });
  } catch (error) {
    console.error("Errore nel recupero impostazioni:", error);
    return {
      success: false,
      error: "Errore nel recupero delle impostazioni"
    };
  }
}

export async function aggiornaImpostazioniScontrino(
  id: string,
  updateData: any
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.ruolo !== "SUPERVISORE" && user.ruolo !== "ADMIN")) {
      return {
        success: false,
        error: "Non autorizzato"
      };
    }

    console.log("PUT - Dati ricevuti:", JSON.stringify({ id, ...updateData }, null, 2));
    console.log("PUT - ID:", id);
    console.log("PUT - UpdateData keys:", Object.keys(updateData));

    if (!id) {
      return {
        success: false,
        error: "ID impostazioni mancante"
      };
    }

    // IMPORTANTE: Assicurati che rimanga attivo!
    const impostazioniAggiornate = await prisma.impostazioniScontrino.update({
      where: { id },
      data: {
        ...updateData,
        attivo: true, // FORZA sempre attivo quando si aggiorna
        modificatoDa: user.id,
        updatedAt: new Date()
      }
    });
    
    console.log("PUT - Impostazioni aggiornate:", {
      nomeAttivita: impostazioniAggiornate.nomeAttivita,
      indirizzo: impostazioniAggiornate.indirizzo,
      telefono: impostazioniAggiornate.telefono
    });

    // Invalidate cache
    revalidatePath("/admin/scontrino");
    revalidatePath("/cassa");

    return serializeDecimalData({
      success: true,
      data: impostazioniAggiornate,
      message: "Impostazioni aggiornate con successo"
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento impostazioni:", error);
    return {
      success: false,
      error: "Errore nell'aggiornamento delle impostazioni"
    };
  }
}

export async function creaImpostazioniScontrino(data: any) {
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

    // Invalidate cache
    revalidatePath("/admin/scontrino");
    revalidatePath("/cassa");

    return serializeDecimalData({
      success: true,
      data: nuoveImpostazioni,
      message: "Impostazioni create con successo"
    });
  } catch (error) {
    console.error("Errore nella creazione impostazioni:", error);
    return {
      success: false,
      error: "Errore nella creazione delle impostazioni"
    };
  }
}