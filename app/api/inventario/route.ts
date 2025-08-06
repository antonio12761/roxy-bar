import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
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

    return NextResponse.json({ 
      success: true, 
      prodotti: prodottiConInventario 
    });
  } catch (error) {
    console.error("Errore GET inventario:", error);
    return NextResponse.json(
      { error: "Errore recupero inventario" },
      { status: 500 }
    );
  }
}