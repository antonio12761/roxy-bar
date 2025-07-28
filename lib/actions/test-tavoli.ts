"use server";

import { prisma } from "@/lib/db";

export async function getTestTavoli() {
  try {
    console.log("🔍 TEST: Recupero tavoli semplificato");
    
    const tavoli = await prisma.tavolo.findMany({
      where: {
        attivo: true
      },
      orderBy: {
        numero: 'asc'
      }
    });
    
    console.log(`✅ TEST: Trovati ${tavoli.length} tavoli`);
    return tavoli;
  } catch (error) {
    console.error("❌ TEST: Errore:", error);
    return [];
  }
}