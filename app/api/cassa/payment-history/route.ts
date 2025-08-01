import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "CASSA"].includes(user.ruolo)) {
      return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    
    let dateFilter = {};
    if (dateParam) {
      const startDate = new Date(dateParam);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateParam);
      endDate.setHours(23, 59, 59, 999);
      
      dateFilter = {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    const payments = await prisma.pagamento.findMany({
      where: dateFilter,
      include: {
        User: {
          select: {
            nome: true
          }
        },
        Ordinazione: {
          select: {
            id: true,
            numero: true,
            Tavolo: {
              select: {
                numero: true
              }
            },
            RigaOrdinazione: {
              include: {
                Prodotto: {
                  select: {
                    nome: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Serializza i dati per evitare problemi con Decimal
    const serializedPayments = payments.map(payment => ({
      id: payment.id,
      importo: payment.importo.toNumber(),
      modalita: payment.modalita,
      clienteNome: payment.clienteNome,
      timestamp: payment.timestamp.toISOString(),
      operatore: payment.User,
      ordinazione: {
        id: payment.Ordinazione.id,
        numero: payment.Ordinazione.numero,
        tavolo: payment.Ordinazione.Tavolo,
        righe: payment.Ordinazione.RigaOrdinazione.map((riga: any) => ({
          id: riga.id,
          quantita: riga.quantita,
          prezzo: riga.prezzo.toNumber(),
          prodotto: riga.Prodotto
        }))
      }
    }));

    return NextResponse.json(serializedPayments);
  } catch (error) {
    console.error("Errore recupero storico pagamenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}