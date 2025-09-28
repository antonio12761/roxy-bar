"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export async function getTavoli() {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return [];
    }
    
    const tavoli = await prisma.tavolo.findMany({
      where: {
        attivo: true,
        visibile: true,
        GruppoTavoli: {
          visibile: true
        }
      },
      include: {
        GruppoTavoli: true,
        Ordinazione: {
          where: {
            stato: {
              in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"]
            }
          },
          select: {
            nomeCliente: true,
            note: true
          },
          orderBy: {
            dataApertura: 'asc'
          },
          take: 1
        }
      },
      orderBy: [
        { GruppoTavoli: { ordinamento: 'asc' } },
        { ordinamento: 'asc' },
        { numero: 'asc' }
      ]
    });
    
    const tavoliMapped = tavoli.map(tavolo => ({
      ...tavolo,
      clienteNome: tavolo.Ordinazione[0]?.nomeCliente || 
                   (tavolo.Ordinazione[0]?.note?.includes('Cliente:') 
                    ? tavolo.Ordinazione[0].note.split('Cliente: ')[1]?.split(' - ')[0] 
                    : null)
    }));
    
    return serializeDecimalData(tavoliMapped);
  } catch (error: any) {
    console.error("Errore recupero tavoli:", error.message);
    return [];
  }
}

export async function getTableOrdersInfo(tableId: number) {
  try {
    const utente = await getCurrentUser();
    if (!utente) {
      return { ordersCount: 0, pendingAmount: 0, orders: [] };
    }
    
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        tavoloId: tableId,
        stato: {
          in: ["ORDINATO", "IN_PREPARAZIONE", "PRONTO", "CONSEGNATO"]
        }
      },
      include: {
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      }
    });
    
    const ordersCount = ordinazioni.filter(o => 
      ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"].includes(o.stato)
    ).length;
    
    let pendingAmount = 0;
    for (const ordinazione of ordinazioni) {
      if (ordinazione.stato === "CONSEGNATO" && ordinazione.statoPagamento !== "COMPLETAMENTE_PAGATO") {
        const totaleOrdine = ordinazione.RigaOrdinazione.reduce((sum, riga) => {
          return sum + (Number(riga.prezzo) * riga.quantita);
        }, 0);
        pendingAmount += totaleOrdine;
      }
    }
    
    return serializeDecimalData({
      ordersCount,
      pendingAmount,
      orders: ordinazioni
    });
  } catch (error) {
    console.error("Errore recupero info tavolo:", error);
    return { ordersCount: 0, pendingAmount: 0, orders: [] };
  }
}

export async function getCustomerNamesForTable(tavoloId: number) {
  try {
    const ordini = await prisma.ordinazione.findMany({
      where: {
        tavoloId: tavoloId,
        dataApertura: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      select: {
        note: true,
        nomeCliente: true,
        dataApertura: true
      },
      orderBy: {
        dataApertura: 'desc' // Cambiato in desc per avere l'ultimo ordine per primo
      },
      take: 10
    });

    const customerNames = new Set<string>();
    let lastCustomerName = "";
    
    ordini.forEach((ordine, index) => {
      let customerName = "";
      
      if (ordine.nomeCliente) {
        customerName = ordine.nomeCliente;
      }
      else if (ordine.note) {
        const match = ordine.note.match(/Cliente:\s*([^-]+)/);
        if (match && match[1]) {
          customerName = match[1].trim();
        }
      }
      
      if (customerName) {
        customerNames.add(customerName);
        // Il primo ordine (più recente) determina l'ultimo cliente
        if (index === 0) {
          lastCustomerName = customerName;
        }
      }
    });

    return {
      success: true,
      customerNames: Array.from(customerNames),
      lastCustomerName: lastCustomerName // Aggiungiamo l'ultimo cliente che ha ordinato
    };
  } catch (error: any) {
    console.error("Errore nomi clienti:", error.message);
    return { 
      success: false, 
      error: "Errore durante il recupero dei nomi dei clienti",
      customerNames: [],
      lastCustomerName: ""
    };
  }
}