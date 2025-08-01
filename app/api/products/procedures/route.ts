import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { prisma as db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// GET - Get procedure for a product
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER", "PREPARA", "CUCINA"].includes(user.ruolo)) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "Product ID richiesto" }, { status: 400 });
    }

    const procedure = await db.productProcedure.findUnique({
      where: { productId: parseInt(productId) },
      include: {
        ProcedureStep: {
          orderBy: { order: "asc" },
          include: {
            ProcedureIngredient: {
              orderBy: { name: "asc" }
            }
          }
        }
      }
    });

    return NextResponse.json(procedure);
  } catch (error) {
    console.error("Errore recupero procedura:", error);
    return NextResponse.json(
      { error: "Errore nel recupero della procedura" },
      { status: 500 }
    );
  }
}

// POST - Create or update procedure
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, steps, glasses = [] } = body;

    if (!productId || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    // Delete existing procedure if any
    await db.productProcedure.deleteMany({
      where: { productId }
    });

    // Create new procedure
    const procedure = await db.productProcedure.create({
      data: {
        id: uuidv4(),
        productId,
        glasses,
        updatedAt: new Date(),
        ProcedureStep: {
          create: steps.map((step: any) => ({
            id: uuidv4(),
            description: step.description,
            order: step.order,
            updatedAt: new Date(),
            ProcedureIngredient: {
              create: (step.ingredients || []).map((ing: any) => ({
                id: uuidv4(),
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                updatedAt: new Date()
              }))
            }
          }))
        }
      },
      include: {
        ProcedureStep: {
          include: {
            ProcedureIngredient: true
          }
        }
      }
    });

    return NextResponse.json(procedure);
  } catch (error) {
    console.error("Errore salvataggio procedura:", error);
    return NextResponse.json(
      { error: "Errore nel salvataggio della procedura" },
      { status: 500 }
    );
  }
}

// DELETE - Delete procedure
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "Product ID richiesto" }, { status: 400 });
    }

    await db.productProcedure.deleteMany({
      where: { productId: parseInt(productId) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore eliminazione procedura:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione della procedura" },
      { status: 500 }
    );
  }
}