"use server";

import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { revalidatePath } from "next/cache";

export async function getInventarioProdotti() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { 
        success: false,
        error: "Non autorizzato" 
      };
    }

    // Recupera tutti i prodotti con le loro quantità disponibili
    const prodotti = await prisma.prodotto.findMany({
      where: {
        disponibile: true,
        isDeleted: false
      },
      include: {
        InventarioEsaurito: true
      },
      orderBy: [
        { categoria: 'asc' },
        { nome: 'asc' }
      ]
    });

    const prodottiConInventario = prodotti.map(p => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      quantitaDisponibile: p.InventarioEsaurito?.quantitaDisponibile ?? 999,
      terminato: p.terminato,
      ultimoAggiornamento: p.InventarioEsaurito?.ultimoAggiornamento
    }));

    return serializeDecimalData({
      success: true,
      data: prodottiConInventario
    });
  } catch (error) {
    console.error("Errore recupero inventario:", error);
    return {
      success: false,
      error: "Errore recupero inventario"
    };
  }
}

export async function aggiornaQuantitaProdotto(
  prodottoId: string,
  quantita: number
) {
  try {
    const user = await getCurrentUser();
    if (!user || !["SUPERVISORE", "ADMIN", "PREPARA", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false,
        error: "Non autorizzato" 
      };
    }

    // Verifica che il prodotto esista
    const prodotto = await prisma.prodotto.findUnique({
      where: { id: prodottoId }
    });

    if (!prodotto) {
      return {
        success: false,
        error: "Prodotto non trovato"
      };
    }

    // Aggiorna o crea record inventario
    const inventario = await prisma.inventarioEsaurito.upsert({
      where: { prodottoId },
      update: {
        quantitaDisponibile: quantita,
        ultimoAggiornamento: new Date(),
        modificatoDa: user.id
      },
      create: {
        prodottoId,
        quantitaDisponibile: quantita,
        modificatoDa: user.id
      }
    });

    // Se la quantità è 0, marca il prodotto come terminato
    if (quantita === 0) {
      await prisma.prodotto.update({
        where: { id: prodottoId },
        data: { terminato: true }
      });
    } else {
      // Altrimenti assicurati che non sia terminato
      await prisma.prodotto.update({
        where: { id: prodottoId },
        data: { terminato: false }
      });
    }

    // Invalida cache
    revalidatePath("/supervisore/inventario");
    revalidatePath("/prepara");

    return serializeDecimalData({
      success: true,
      data: inventario,
      message: `Quantità aggiornata a ${quantita}`
    });
  } catch (error) {
    console.error("Errore aggiornamento inventario:", error);
    return {
      success: false,
      error: "Errore aggiornamento inventario"
    };
  }
}