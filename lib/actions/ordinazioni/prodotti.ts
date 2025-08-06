"use server";

import { prisma } from "@/lib/db";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export async function getProdotti() {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        nome: true,
        prezzo: true,
        categoria: true,
        postazione: true,
        codice: true,
        requiresGlasses: true,
        disponibile: true,
        terminato: true,
        isMiscelato: true
      },
      orderBy: {
        categoria: 'asc'
      }
    });

    return serializeDecimalData(prodotti);
  } catch (error: any) {
    console.error("Errore recupero prodotti:", error.message);
    return [];
  }
}

export async function getAllProdotti() {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        nome: true,
        prezzo: true,
        categoria: true,
        postazione: true,
        codice: true,
        requiresGlasses: true,
        disponibile: true,
        terminato: true,
        ingredienti: true,
        isMiscelato: true
      },
      orderBy: {
        categoria: 'asc'
      }
    });

    return serializeDecimalData(prodotti);
  } catch (error: any) {
    console.error("Errore recupero tutti i prodotti:", error.message);
    return [];
  }
}