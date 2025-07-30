"use server";

import { prisma } from "@/lib/db";

export async function bulkUpdateProducts(
  productIds: number[],
  updates: {
    disponibile?: boolean;
    terminato?: boolean;
    categoria?: string;
    prezzo?: number;
  }
) {
  try {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const productId of productIds) {
      try {
        await prisma.prodotto.update({
          where: { id: productId },
          data: updates
        });
        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`Prodotto ${productId}: ${error.message}`);
      }
    }

    return {
      success: true,
      successCount,
      errorCount,
      errors: errors.slice(0, 5) // Return max 5 errors
    };
  } catch (error) {
    return {
      success: false,
      error: "Errore durante l'aggiornamento in blocco"
    };
  }
}

export async function bulkUpdateProductsWithPriceAdjustment(
  productIds: number[],
  updates: {
    disponibile?: boolean;
    terminato?: boolean;
    categoria?: string;
  },
  priceAdjustment?: {
    type: 'fixed' | 'percentage';
    value: number;
  }
) {
  try {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const productId of productIds) {
      try {
        // Get current product to calculate new price if needed
        const product = await prisma.prodotto.findUnique({
          where: { id: productId },
          select: { prezzo: true }
        });

        if (!product) {
          errorCount++;
          errors.push(`Prodotto ${productId}: non trovato`);
          continue;
        }

        const updateData: any = { ...updates };

        // Calculate new price if adjustment is provided
        if (priceAdjustment) {
          const currentPrice = Number(product.prezzo);
          if (priceAdjustment.type === 'fixed') {
            updateData.prezzo = Math.max(0, currentPrice + priceAdjustment.value);
          } else {
            updateData.prezzo = Math.max(0, currentPrice * (1 + priceAdjustment.value / 100));
          }
        }

        await prisma.prodotto.update({
          where: { id: productId },
          data: updateData
        });
        
        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`Prodotto ${productId}: ${error.message}`);
      }
    }

    return {
      success: true,
      successCount,
      errorCount,
      errors: errors.slice(0, 5)
    };
  } catch (error) {
    return {
      success: false,
      error: "Errore durante l'aggiornamento in blocco"
    };
  }
}