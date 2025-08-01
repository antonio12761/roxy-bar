'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-multi-tenant';
import { revalidatePath } from 'next/cache';
import { serializeDecimalData } from '@/lib/utils/decimal-serializer';

export async function addRecentProduct(tavoloId: number, prodottoId: number) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Non autorizzato');
  }

  try {
    // Upsert to handle duplicate entries
    const prodottoRecente = await prisma.prodottoRecente.upsert({
      where: {
        tavoloId_prodottoId: {
          tavoloId,
          prodottoId
        }
      },
      update: {
        orderedAt: new Date(),
        utenteId: user.id
      },
      create: {
        tavoloId,
        prodottoId,
        utenteId: user.id
      },
      include: {
        Prodotto: true
      }
    });

    // Clean up old entries - keep only last 20 recent products per table
    const oldProducts = await prisma.prodottoRecente.findMany({
      where: { tavoloId },
      orderBy: { orderedAt: 'desc' },
      skip: 20,
      select: { id: true }
    });

    if (oldProducts.length > 0) {
      await prisma.prodottoRecente.deleteMany({
        where: {
          id: { in: oldProducts.map(p => p.id) }
        }
      });
    }

    revalidatePath(`/cameriere/tavolo/${tavoloId}`);
    return { success: true, prodottoRecente: serializeDecimalData(prodottoRecente) };
  } catch (error) {
    console.error('Errore nell\'aggiungere prodotto recente:', error);
    return { success: false, error: 'Errore nell\'aggiungere prodotto recente' };
  }
}

export async function getRecentProducts(tavoloId: number) {
  try {
    const recentProducts = await prisma.prodottoRecente.findMany({
      where: { tavoloId },
      orderBy: { orderedAt: 'desc' },
      take: 20,
      include: {
        Prodotto: true
      }
    });

    // Filter out unavailable products
    const availableRecentProducts = recentProducts.filter(
      rp => rp.Prodotto.disponibile !== false
    );

    return { success: true, prodottiRecenti: serializeDecimalData(availableRecentProducts) };
  } catch (error) {
    console.error('Errore nel recuperare prodotti recenti:', error);
    return { success: false, error: 'Errore nel recuperare prodotti recenti', prodottiRecenti: [] };
  }
}

export async function removeRecentProduct(tavoloId: number, prodottoId: number) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Non autorizzato');
  }

  try {
    await prisma.prodottoRecente.delete({
      where: {
        tavoloId_prodottoId: {
          tavoloId,
          prodottoId
        }
      }
    });

    revalidatePath(`/cameriere/tavolo/${tavoloId}`);
    return { success: true };
  } catch (error) {
    console.error('Errore nel rimuovere prodotto recente:', error);
    return { success: false, error: 'Errore nel rimuovere prodotto recente' };
  }
}

export async function clearRecentProducts(tavoloId: number) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Non autorizzato');
  }

  try {
    await prisma.prodottoRecente.deleteMany({
      where: { tavoloId }
    });

    revalidatePath(`/cameriere/tavolo/${tavoloId}`);
    return { success: true };
  } catch (error) {
    console.error('Errore nel cancellare prodotti recenti:', error);
    return { success: false, error: 'Errore nel cancellare prodotti recenti' };
  }
}

// Batch update when products become unavailable
export async function removeUnavailableRecentProducts(prodottoIds: number[]) {
  try {
    await prisma.prodottoRecente.deleteMany({
      where: {
        prodottoId: { in: prodottoIds }
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Errore nel rimuovere prodotti non disponibili:', error);
    return { success: false, error: 'Errore nel rimuovere prodotti non disponibili' };
  }
}