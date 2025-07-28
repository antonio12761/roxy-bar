"use server";

import { prisma } from "@/lib/db";

export async function rinominaCategoriaImproved(oldName: string, newName: string) {
  try {
    console.log(`🔄 Rinominando "${oldName}" → "${newName}"`);
    
    // Verifica se esistono prodotti prima del rename
    const preCheckExact = await prisma.prodotto.count({
      where: {
        categoria: oldName,
        isDeleted: false
      }
    });
    
    const preCheckSubs = await prisma.prodotto.count({
      where: {
        categoria: {
          startsWith: `${oldName} > `
        },
        isDeleted: false
      }
    });
    
    console.log(`📊 Prima del rename - Esatti: ${preCheckExact}, Sottocategorie: ${preCheckSubs}`);
    
    if (preCheckExact === 0 && preCheckSubs === 0) {
      return {
        success: false,
        error: `Nessun prodotto trovato per la categoria "${oldName}". Verifica che la categoria esista.`,
        count: 0
      };
    }
    
    // Prima aggiorna i prodotti che corrispondono esattamente
    const exactResult = await prisma.prodotto.updateMany({
      where: {
        categoria: oldName,
        isDeleted: false
      },
      data: {
        categoria: newName
      }
    });
    
    console.log(`📊 Prodotti aggiornati (esatti): ${exactResult.count}`);
    
    // Poi aggiorna tutti i prodotti nelle sottocategorie se è una categoria principale
    let subcategoryCount = 0;
    if (!oldName.includes(' > ')) {
      // È categoria principale - aggiorna anche le sottocategorie
      const subcategories = await prisma.prodotto.findMany({
        where: {
          categoria: {
            startsWith: `${oldName} > `
          },
          isDeleted: false
        },
        select: { categoria: true },
        distinct: ['categoria']
      });
      
      console.log(`🔍 Sottocategorie trovate: ${subcategories.length}`);
      
      for (const sub of subcategories) {
        const newSubPath = sub.categoria.replace(`${oldName} > `, `${newName} > `);
        console.log(`  🔄 "${sub.categoria}" → "${newSubPath}"`);
        
        const subResult = await prisma.prodotto.updateMany({
          where: {
            categoria: sub.categoria,
            isDeleted: false
          },
          data: {
            categoria: newSubPath
          }
        });
        
        console.log(`  📊 Aggiornati: ${subResult.count} prodotti`);
        subcategoryCount += subResult.count;
      }
    }
    
    const totalUpdated = exactResult.count + subcategoryCount;
    
    // Verifica post-rename
    const postCheckNew = await prisma.prodotto.count({
      where: {
        categoria: {
          startsWith: newName
        },
        isDeleted: false
      }
    });
    
    console.log(`✅ Verifica post-rename: ${postCheckNew} prodotti con nuovo nome`);
    
    return {
      success: true,
      message: `Categoria rinominata! ${totalUpdated} prodotti aggiornati.`,
      count: totalUpdated
    };
    
  } catch (error) {
    console.error("Errore durante la modifica:", error);
    return {
      success: false,
      error: `Errore durante la modifica: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    };
  }
}