"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function searchClienti(searchTerm: string = '') {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Cerca sia nei clienti registrati che nei nomi usati nei pagamenti precedenti
    const [clienti, pagamentiNomi] = await Promise.all([
      // Cerca nei clienti registrati
      prisma.cliente.findMany({
        where: {
          tenantId: user.tenantId,
          OR: [
            { nome: { contains: searchTerm, mode: 'insensitive' } },
            { cognome: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          nome: true,
          cognome: true
        },
        take: 10
      }),
      
      // Cerca nei nomi usati nei pagamenti precedenti
      prisma.pagamento.findMany({
        where: {
          clienteNome: {
            contains: searchTerm,
            mode: 'insensitive'
          },
          Ordinazione: {
            User: {
              tenantId: user.tenantId
            }
          }
        },
        select: {
          clienteNome: true
        },
        distinct: ['clienteNome'],
        take: 10
      })
    ]);

    // Combina i risultati
    const suggestions = new Set<string>();
    
    // Aggiungi i clienti registrati
    clienti.forEach(cliente => {
      const nomeCompleto = cliente.cognome 
        ? `${cliente.nome} ${cliente.cognome}`
        : cliente.nome;
      suggestions.add(nomeCompleto);
    });
    
    // Aggiungi i nomi dai pagamenti
    pagamentiNomi.forEach(p => {
      if (p.clienteNome) {
        suggestions.add(p.clienteNome);
      }
    });

    // Converti in array e ordina
    return Array.from(suggestions)
      .filter(nome => nome.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort()
      .slice(0, 15);
      
  } catch (error) {
    console.error('Errore nella ricerca clienti:', error);
    return [];
  }
}

// Recupera gli ultimi clienti usati di recente
export async function getRecentClienti() {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Recupera gli ultimi 10 nomi usati nei pagamenti
    const recentPayments = await prisma.pagamento.findMany({
      where: {
        clienteNome: {
          not: null
        },
        Ordinazione: {
          User: {
            tenantId: user.tenantId
          }
        }
      },
      select: {
        clienteNome: true,
        timestamp: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 20
    });

    // Rimuovi duplicati mantenendo l'ordine
    const uniqueNames = new Map<string, Date>();
    recentPayments.forEach(p => {
      if (p.clienteNome && !uniqueNames.has(p.clienteNome)) {
        uniqueNames.set(p.clienteNome, p.timestamp);
      }
    });

    return Array.from(uniqueNames.keys()).slice(0, 10);
    
  } catch (error) {
    console.error('Errore nel recupero clienti recenti:', error);
    return [];
  }
}