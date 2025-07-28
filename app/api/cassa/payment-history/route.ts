import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Verifica permessi (CASSA o superiore)
    if (!["ADMIN", "MANAGER", "OPERATORE", "CASSA"].includes(user.ruolo)) {
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
        operatore: {
          select: {
            nome: true
          }
        },
        ordinazione: {
          select: {
            id: true,
            numero: true,
            tavolo: {
              select: {
                numero: true
              }
            },
            righe: {
              include: {
                prodotto: {
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
      operatore: payment.operatore,
      ordinazione: {
        id: payment.ordinazione.id,
        numero: payment.ordinazione.numero,
        tavolo: payment.ordinazione.tavolo,
        righe: payment.ordinazione.righe.map(riga => ({
          id: riga.id,
          quantita: riga.quantita,
          prezzo: riga.prezzo.toNumber(),
          prodotto: riga.prodotto
        }))
      }
    }));

    return NextResponse.json(serializedPayments);
  } catch (error) {
    console.error("Errore recupero storico pagamenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}