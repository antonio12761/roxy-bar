"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function getUtentiCamerieri() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Non autenticato" };
    }

    const camerieri = await prisma.user.findMany({
      where: {
        tenantId: currentUser.tenantId,
        ruolo: 'CAMERIERE'
      },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true
      },
      orderBy: [
        { cognome: 'asc' },
        { nome: 'asc' }
      ]
    });

    return {
      success: true,
      camerieri
    };
  } catch (error) {
    console.error("Errore recupero camerieri:", error);
    return {
      success: false,
      error: "Errore nel recupero dei camerieri"
    };
  }
}