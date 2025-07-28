"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { creaOrdinazione } from "@/lib/actions/ordinazioni";
import { ContoScalareService } from "@/lib/services/contoScalare";
import { ContributoService } from "@/lib/services/contributo";
import { TipoContributo } from "@prisma/client";

interface ProductOrder {
  prodotto: {
    id: number;
    nome: string;
    prezzo: number;
    categoria: string;
  };
  quantita: number;
}

interface OrdinaPerAltriData {
  clienteOrdinante: string;
  destinationType: 'tavolo' | 'cliente';
  tavoloDestinatario?: number;
  clienteDestinatario?: string;
  items: ProductOrder[];
  pagamentoImmediato: boolean;
}

export async function creaOrdinazionePerAltri(data: OrdinaPerAltriData) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    if (!["ADMIN", "MANAGER", "OPERATORE", "CAMERIERE"].includes(utente.ruolo)) {
      return { success: false, error: "Permessi insufficienti" };
    }

    const totaleOrdine = data.items.reduce((sum, item) => 
      sum + (item.prodotto.prezzo * item.quantita), 0
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Trova o crea il cliente ordinante
      let clienteOrdinante = await tx.cliente.findFirst({
        where: { nome: data.clienteOrdinante }
      });

      if (!clienteOrdinante) {
        clienteOrdinante = await tx.cliente.create({
          data: {
            nome: data.clienteOrdinante,
            telefono: "", // Vuoto per ora
            saldo: 0
          }
        });
      }

      // 2. Gestisce il destinatario (tavolo o cliente)
      let tavoloDestinatario = null;
      let clienteDestinatario = null;

      if (data.destinationType === 'tavolo' && data.tavoloDestinatario) {
        tavoloDestinatario = await tx.tavolo.findUnique({
          where: { id: data.tavoloDestinatario }
        });
        
        if (!tavoloDestinatario) {
          throw new Error("Tavolo destinatario non trovato");
        }
      } else if (data.destinationType === 'cliente' && data.clienteDestinatario) {
        clienteDestinatario = await tx.cliente.findFirst({
          where: { nome: data.clienteDestinatario }
        });

        if (!clienteDestinatario) {
          clienteDestinatario = await tx.cliente.create({
            data: {
              nome: data.clienteDestinatario,
              telefono: "", 
              saldo: 0
            }
          });
        }
      }

      // 3. Crea l'ordinazione per il destinatario
      const ordinazioneData = {
        tavoloId: tavoloDestinatario?.id,
        clienteId: clienteDestinatario?.id,
        tipo: "TAVOLO" as const,
        note: `Ordinato da: ${data.clienteOrdinante} per ${
          data.destinationType === 'tavolo' 
            ? `Tavolo ${tavoloDestinatario?.numero}` 
            : data.clienteDestinatario
        }`,
        prodotti: data.items.map(item => ({
          prodottoId: item.prodotto.id,
          quantita: item.quantita,
          prezzo: item.prodotto.prezzo
        }))
      };

      // Usa la funzione esistente per creare l'ordinazione
      const resultOrdinazione = await creaOrdinazione(ordinazioneData);
      
      if (!resultOrdinazione.success || !resultOrdinazione.ordinazione) {
        throw new Error("Errore nella creazione dell'ordinazione");
      }

      const ordinazione = resultOrdinazione.ordinazione;

      // 4. Gestisce il pagamento
      if (data.pagamentoImmediato) {
        // Pagamento immediato - il cliente ordinante paga subito
        
        // Crea il contributo per tracciare che ha ordinato per altri
        await ContributoService.ordinaPerAltri(
          clienteOrdinante.id,
          tavoloDestinatario?.id || 0,
          ordinazione.id,
          totaleOrdine,
          clienteDestinatario?.id
        );

        // Se c'è un conto scalare aperto per il destinatario, registra il pagamento
        if (tavoloDestinatario) {
          const contoTavolo = await ContoScalareService.getOrCreateContoTavolo(
            tavoloDestinatario.id, 
            utente.id
          );
          
          // Aggiunge l'ordine al conto
          await ContoScalareService.aggiungiOrdine(
            contoTavolo.id,
            ordinazione.id,
            totaleOrdine,
            `Ordine da ${data.clienteOrdinante}: ${data.items.map(i => 
              `${i.prodotto.nome} x${i.quantita}`
            ).join(', ')}`,
            utente.id
          );

          // Registra il pagamento immediato
          await ContoScalareService.registraPagamento(
            contoTavolo.id,
            totaleOrdine,
            `Pagamento immediato da ${data.clienteOrdinante}`,
            clienteOrdinante.id,
            utente.id
          );
        }

        return {
          success: true,
          ordinazione,
          message: `Ordine creato e pagato da ${data.clienteOrdinante}`,
          pagamentoImmediato: true
        };

      } else {
        // Aggiunge al conto del cliente ordinante

        // Ottiene o crea il conto scalare del cliente ordinante
        const contoOrdinante = await ContoScalareService.getOrCreateContoCliente(
          clienteOrdinante.id,
          clienteOrdinante.nome,
          utente.id
        );

        // Aggiunge l'ordine al conto del cliente ordinante
        await ContoScalareService.aggiungiOrdine(
          contoOrdinante.id,
          ordinazione.id,
          totaleOrdine,
          `Ordine per ${
            data.destinationType === 'tavolo' 
              ? `Tavolo ${tavoloDestinatario?.numero}` 
              : data.clienteDestinatario
          }: ${data.items.map(i => 
            `${i.prodotto.nome} x${i.quantita}`
          ).join(', ')}`,
          utente.id
        );

        // Crea il contributo per tracciare l'ordine per altri
        await ContributoService.ordinaPerAltri(
          clienteOrdinante.id,
          tavoloDestinatario?.id || 0,
          ordinazione.id,
          totaleOrdine,
          clienteDestinatario?.id
        );

        return {
          success: true,
          ordinazione,
          message: `Ordine aggiunto al conto di ${data.clienteOrdinante}`,
          pagamentoImmediato: false,
          contoId: contoOrdinante.id,
          saldoRimanente: contoOrdinante.saldoRimanente + totaleOrdine
        };
      }
    });

    return result;

  } catch (error: any) {
    console.error("❌ Errore creazione ordinazione per altri:", error);
    return { 
      success: false, 
      error: error.message || "Errore interno del server" 
    };
  }
}

/**
 * Ottiene il riepilogo conti per un tavolo
 */
export async function getRiepilogoContiTavolo(tavoloId: number) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const conti = await ContoScalareService.getContiApertiTavolo(tavoloId);
    
    const riepilogo = {
      contiAperti: conti.length,
      totaleOrdinato: conti.reduce((sum, conto) => sum + conto.totaleOrdinato, 0),
      totalePagato: conti.reduce((sum, conto) => sum + conto.totalePagato, 0),
      saldoRimanente: conti.reduce((sum, conto) => sum + conto.saldoRimanente, 0),
      dettagliConti: conti
    };

    return { success: true, riepilogo };

  } catch (error: any) {
    console.error("❌ Errore recupero conti tavolo:", error);
    return { 
      success: false, 
      error: error.message || "Errore interno del server" 
    };
  }
}

/**
 * Ottiene tutti i conti scalari aperti nel sistema
 */
export async function getTuttiContiScalari() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const conti = await ContoScalareService.getTuttiContiAperti();
    
    const riepilogo = {
      contiAperti: conti.length,
      totaleOrdinato: conti.reduce((sum, conto) => sum + conto.totaleOrdinato, 0),
      totalePagato: conti.reduce((sum, conto) => sum + conto.totalePagato, 0),
      saldoRimanente: conti.reduce((sum, conto) => sum + conto.saldoRimanente, 0),
      dettagliConti: conti
    };

    return { success: true, riepilogo };

  } catch (error: any) {
    console.error("❌ Errore recupero tutti i conti:", error);
    return { 
      success: false, 
      error: error.message || "Errore interno del server" 
    };
  }
}

/**
 * Salda parzialmente un conto
 */
export async function saldaContoParziale(
  contoId: string, 
  importo: number, 
  clientePagatoreId?: string,
  modalitaPagamento: string = "CONTANTI"
) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { success: false, error: "Utente non autenticato" };
    }

    const saldoAttuale = await ContoScalareService.getSaldoConto(contoId);
    
    if (importo > saldoAttuale) {
      return { 
        success: false, 
        error: `Importo superiore al saldo rimanente (€${saldoAttuale.toFixed(2)})` 
      };
    }

    const contoAggiornato = await ContoScalareService.registraPagamento(
      contoId,
      importo,
      `Pagamento ${modalitaPagamento} - €${importo.toFixed(2)}`,
      clientePagatoreId || null,
      utente.id
    );

    return { 
      success: true, 
      conto: contoAggiornato,
      message: `Pagamento di €${importo.toFixed(2)} registrato con successo`
    };

  } catch (error: any) {
    console.error("❌ Errore saldo parziale:", error);
    return { 
      success: false, 
      error: error.message || "Errore interno del server" 
    };
  }
}