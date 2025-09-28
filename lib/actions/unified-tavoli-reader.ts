"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export interface UnifiedTavoloData {
  id: number;
  numero: number;
  nome: string;
  descrizione?: string | null;
  posizione?: string | null;
  posti?: number | null;
  stato: string;
  ordinamento: number;
  gruppoId: number;
  gruppoNome: string;
  gruppoColore?: string | null;
  gruppoIcona?: string | null;
  gruppoOrdinamento: number;
  hasActiveOrders: boolean;
  clienteNome?: string | null;
  ordiniAttivi?: number;
}

export interface UnifiedGruppoData {
  id: number;
  nome: string;
  descrizione?: string | null;
  colore?: string | null;
  icona?: string | null;
  ordinamento: number;
  numeroTavoli: number;
  tavoli: UnifiedTavoloData[];
}

/**
 * Funzione unificata per leggere gruppi e tavoli con ordinamento consistente
 * Usata sia da admin che da cameriere per garantire stesso ordine
 */
export async function getUnifiedGruppiTavoli(includeInvisible = false) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autorizzato", gruppi: [] };
    }

    const gruppiWhere: any = { attivo: true };
    const tavoliWhere: any = { attivo: true };
    
    // Se non includeInvisible, filtra solo quelli visibili
    if (!includeInvisible) {
      gruppiWhere.visibile = true;
      tavoliWhere.visibile = true;
    }

    const gruppi = await prisma.gruppoTavoli.findMany({
      where: gruppiWhere,
      include: {
        Tavolo: {
          where: tavoliWhere,
          orderBy: [
            { ordinamento: 'asc' },
            { numero: 'asc' }
          ],
          include: {
            Ordinazione: {
              where: {
                stato: {
                  in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
                }
              },
              select: {
                id: true,
                numero: true,
                stato: true,
                nomeCliente: true,
                note: true,
                dataApertura: true
              },
              orderBy: {
                dataApertura: 'asc'
              }
            }
          }
        },
        _count: {
          select: { Tavolo: true }
        }
      },
      orderBy: { ordinamento: 'asc' }
    });

    // Trasforma i dati in formato unificato
    const gruppiUnificati: UnifiedGruppoData[] = gruppi.map(gruppo => {
      const tavoliUnificati: UnifiedTavoloData[] = gruppo.Tavolo.map(tavolo => {
        const primoOrdineAttivo = tavolo.Ordinazione[0];
        const clienteNome = primoOrdineAttivo?.nomeCliente || 
                          (primoOrdineAttivo?.note?.includes('Cliente:') 
                           ? primoOrdineAttivo.note.split('Cliente: ')[1]?.split(' - ')[0] 
                           : null);

        return {
          id: tavolo.id,
          numero: tavolo.numero,
          nome: tavolo.nome,
          descrizione: tavolo.descrizione,
          posizione: tavolo.posizione,
          posti: tavolo.posti,
          stato: tavolo.stato,
          ordinamento: tavolo.ordinamento,
          gruppoId: gruppo.id,
          gruppoNome: gruppo.nome,
          gruppoColore: gruppo.colore,
          gruppoIcona: gruppo.icona,
          gruppoOrdinamento: gruppo.ordinamento,
          hasActiveOrders: tavolo.Ordinazione.length > 0,
          clienteNome,
          ordiniAttivi: tavolo.Ordinazione.length
        };
      });

      return {
        id: gruppo.id,
        nome: gruppo.nome,
        descrizione: gruppo.descrizione,
        colore: gruppo.colore,
        icona: gruppo.icona,
        ordinamento: gruppo.ordinamento,
        numeroTavoli: gruppo._count.Tavolo,
        tavoli: tavoliUnificati
      };
    });

    return serializeDecimalData({
      success: true,
      gruppi: gruppiUnificati
    });

  } catch (error) {
    console.error("Errore lettura unificata gruppi tavoli:", error);
    return {
      success: false,
      error: 'Errore nel recupero dei gruppi e tavoli',
      gruppi: []
    };
  }
}

/**
 * Ottiene solo la lista dei tavoli ordinata (per compatibilità con getTavoli esistente)
 */
export async function getUnifiedTavoliList(includeInvisible = false) {
  const result = await getUnifiedGruppiTavoli(includeInvisible);
  
  if (!result.success) {
    return [];
  }

  // Estrai tutti i tavoli mantenendo l'ordine
  const tavoliList: UnifiedTavoloData[] = [];
  for (const gruppo of result.gruppi) {
    tavoliList.push(...gruppo.tavoli);
  }

  return tavoliList;
}