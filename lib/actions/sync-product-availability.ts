"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

export async function syncProductAvailability() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const products = await prisma.prodotto.findMany({
      select: {
        id: true,
        nome: true,
        disponibile: true,
        terminato: true,
        updatedAt: true
      }
    });

    console.log(`[syncProductAvailability] Fetched ${products.length} products for tenant ${user.tenantId}`);
    console.log(`[syncProductAvailability] Unavailable products: ${products.filter(p => !p.disponibile).map(p => p.nome).join(', ')}`);

    return {
      success: true,
      products: products.map(p => ({
        id: p.id,
        nome: p.nome,
        disponibile: p.disponibile,
        terminato: p.terminato,
        updatedAt: p.updatedAt.toISOString()
      }))
    };
  } catch (error) {
    console.error("Error syncing product availability:", error);
    return { success: false, error: "Errore nel sincronizzare la disponibilità prodotti" };
  }
}