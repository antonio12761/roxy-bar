import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { prisma as db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "MANAGER"].includes(user.ruolo)) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "File non fornito" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: "Il file CSV deve contenere almeno l'intestazione e una riga di dati" }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['Nome Prodotto', 'Prezzo', 'Categoria', 'Postazione'];
    
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        return NextResponse.json({ error: `Intestazione mancante: ${header}` }, { status: 400 });
      }
    }

    const results: {
      success: number;
      errors: { row: number; error: string }[];
      created: { id: string; nome: string }[];
    } = {
      success: 0,
      errors: [],
      created: []
    };

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          results.errors.push({ row: i + 1, error: "Numero di colonne non corrispondente" });
          continue;
        }

        const productData: Record<string, string> = {};
        headers.forEach((header, index) => {
          productData[header] = values[index];
        });

        const nome = productData['Nome Prodotto'];
        const prezzo = parseFloat(productData['Prezzo']);
        const descrizione = productData['Descrizione'] || null;
        const categoria = productData['Categoria'];
        const ingredienti = productData['Ingredienti'] || '';
        const procedure = productData['Procedure'] || '';
        const bicchieri = productData['Bicchieri'] || '';
        const postazione = productData['Postazione'];
        const tempoPreparazione = productData['Tempo Preparazione'] ? parseInt(productData['Tempo Preparazione']) : 5;

        if (!nome || isNaN(prezzo) || !categoria || !postazione) {
          results.errors.push({ row: i + 1, error: "Dati obbligatori mancanti o non validi" });
          continue;
        }

        const validCategorie = ['ALCOLICI', 'APERITIVI', 'BIBITE', 'BIRRE', 'CAFFETTERIA', 'COCKTAIL', 'GELATI', 'PANINI'];
        if (!validCategorie.includes(categoria)) {
          results.errors.push({ row: i + 1, error: `Categoria non valida: ${categoria}` });
          continue;
        }

        const validPostazioni = ['PREPARA', 'CUCINA', 'BANCO', 'IMMEDIATO'];
        if (!validPostazioni.includes(postazione)) {
          results.errors.push({ row: i + 1, error: `Postazione non valida: ${postazione}` });
          continue;
        }

        const product = await db.prodotto.create({
          data: {
            nome,
            prezzo,
            descrizione,
            categoria,
            postazione: postazione as any,
            tempoPreparazione,
            disponibile: true,
            ingredienti: ingredienti || null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        if (procedure) {
          const steps: Array<{
            description: string;
            order: number;
            ingredients: Array<{ name: string; quantity: number; unit: string; }>
          }> = procedure.split('|').map((step: string, index: number) => ({
            description: step.trim(),
            order: index + 1,
            ingredients: []
          }));

          if (ingredienti) {
            const ingredientsList = ingredienti.split(';').map((ing: string) => {
              const parts = ing.split(':');
              if (parts.length >= 2) {
                const name = parts[0].trim();
                const quantityUnit = parts[1].trim();
                const match = quantityUnit.match(/^([\d.]+)\s*(.*)$/);
                
                if (match) {
                  return {
                    name,
                    quantity: parseFloat(match[1]),
                    unit: match[2] || 'pz'
                  };
                } else {
                  return {
                    name,
                    quantity: 0,
                    unit: quantityUnit
                  };
                }
              }
              return null;
            }).filter((item): item is { name: string; quantity: number; unit: string; } => item !== null);

            if (steps.length > 0 && ingredientsList.length > 0) {
              steps[0].ingredients = ingredientsList;
            }
          }

          const glassesList = bicchieri ? [bicchieri] : [];

          await db.productProcedure.create({
            data: {
              id: uuidv4(),
              productId: product.id,
              glasses: glassesList,
              createdAt: new Date(),
              updatedAt: new Date(),
              ProcedureStep: {
                create: steps.map((step: any) => ({
                  id: uuidv4(),
                  description: step.description,
                  order: step.order,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  ProcedureIngredient: {
                    create: step.ingredients.map((ing: any) => ({
                      id: uuidv4(),
                      name: ing.name,
                      quantity: ing.quantity,
                      unit: ing.unit,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    }))
                  }
                }))
              }
            }
          });
        }

        results.success++;
        results.created.push({ id: product.id.toString(), nome: product.nome });

      } catch (error) {
        console.error(`Errore riga ${i + 1}:`, error);
        results.errors.push({ row: i + 1, error: error instanceof Error ? error.message : 'Errore sconosciuto' });
      }
    }

    return NextResponse.json({
      message: `Importazione completata: ${results.success} prodotti creati`,
      results
    });

  } catch (error) {
    console.error("Errore importazione CSV:", error);
    return NextResponse.json(
      { error: "Errore durante l'importazione del file CSV" },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}