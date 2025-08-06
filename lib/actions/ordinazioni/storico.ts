"use server";

import { prisma } from "@/lib/db";
import type { FiltriStorico } from "./types";

export async function getStoricoOrdinazioni(filters?: FiltriStorico) {
  try {
    const where: any = {
      stato: "PAGATO",
      statoPagamento: "COMPLETAMENTE_PAGATO"
    };

    if (filters?.dataInizio || filters?.dataFine) {
      where.dataChiusura = {};
      if (filters.dataInizio) {
        where.dataChiusura.gte = filters.dataInizio;
      }
      if (filters.dataFine) {
        where.dataChiusura.lte = filters.dataFine;
      }
    }

    if (filters?.tavoloId) {
      where.tavoloId = filters.tavoloId;
    }

    if (filters?.cameriereId) {
      where.operatoreId = filters.cameriereId;
    }

    const ordinazioni = await prisma.ordinazione.findMany({
      where,
      include: {
        Tavolo: {
          select: {
            numero: true,
            zona: true
          }
        },
        User: {
          select: {
            nome: true
          }
        },
        RigaOrdinazione: {
          include: {
            Prodotto: {
              select: {
                nome: true,
                categoria: true,
                prezzo: true
              }
            }
          }
        },
        Pagamento: {
          include: {
            User: {
              select: {
                nome: true
              }
            }
          }
        }
      },
      orderBy: {
        dataChiusura: 'desc'
      },
      take: filters?.limit || 100
    });

    return ordinazioni.map(ord => ({
      id: ord.id,
      numero: ord.numero,
      tavolo: ord.Tavolo,
      tipo: ord.tipo,
      cameriere: ord.User,
      stato: ord.stato,
      dataApertura: ord.dataApertura,
      dataChiusura: ord.dataChiusura,
      totale: ord.totale.toNumber(),
      righe: ord.RigaOrdinazione.map((riga: any) => ({
        id: riga.id,
        prodotto: {
          nome: riga.Prodotto.nome,
          categoria: riga.Prodotto.categoria
        },
        quantita: riga.quantita,
        prezzo: riga.prezzo.toNumber(),
        stato: riga.stato
      })),
      pagamenti: ord.Pagamento.map((pag: any) => ({
        id: pag.id,
        importo: pag.importo.toNumber(),
        modalita: pag.modalita,
        operatore: pag.User?.nome,
        dataCreazione: pag.dataCreazione
      })),
      durataMinuti: ord.dataChiusura ? 
        Math.floor((new Date(ord.dataChiusura).getTime() - new Date(ord.dataApertura).getTime()) / 60000) : 
        null
    }));
  } catch (error) {
    console.error("Errore recupero storico:", error);
    return [];
  }
}