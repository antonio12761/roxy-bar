"use server";

import { prisma } from "@/lib/db";

export async function getProductsAvailability() {
  try {
    const products = await prisma.prodotto.findMany({
      select: {
        id: true,
        disponibile: true,
        terminato: true,
        updatedAt: true
      }
    });
    
    return {
      success: true,
      products: products.map(p => ({
        id: p.id,
        disponibile: p.disponibile,
        terminato: p.terminato,
        updatedAt: p.updatedAt.toISOString()
      }))
    };
  } catch (error) {
    console.error("Error fetching product availability:", error);
    return { success: false, error: "Errore nel recupero disponibilità prodotti" };
  }
}