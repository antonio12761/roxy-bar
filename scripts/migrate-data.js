const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper per emoji predefinite
function getCategoryEmoji(category) {
  const emojiMap = {
    'CAFFETTERIA': '☕',
    'BIBITE': '🥤', 
    'BIRRE': '🍺',
    'ALCOLICI': '🍸',
    'APERITIVI': '🍹',
    'COCKTAIL': '🍹',
    'DISTILLATI': '🥃',
    'VINI': '🍷',
    'PANINI': '🥪',
    'GELATI': '🍦',
    'Gin': '🍸',
    'Vodka': '🍸', 
    'Rum': '🥃',
    'Whisky': '🥃',
    'Cognac': '🥃',
    'Grappa': '🥃',
    'Rosso': '🍷',
    'Bianco': '🍷',
    'Rosato': '🍷',
    'Spumante': '🍾'
  };
  return emojiMap[category] || '🍽️';
}

// Helper per costruire il path completo
function buildFullPath(categoria, categorieMap) {
  if (!categoria.parentId) {
    return categoria.nome;
  }
  const parent = categorieMap.get(categoria.parentId);
  if (!parent) {
    return categoria.nome;
  }
  return `${buildFullPath(parent, categorieMap)} > ${categoria.nome}`;
}

async function migraCategorieEsistenti() {
  try {
    console.log('🔍 Analisi categorie esistenti...');
    
    // Ottieni tutte le categorie esistenti dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      where: { isDeleted: false }
    });

    const categorieEsistenti = prodotti.map(p => p.categoria);
    const categorieUniche = new Set();
    
    // Estrai tutte le categorie principali e sottocategorie
    for (const categoria of categorieEsistenti) {
      const parti = categoria.split(' > ');
      for (let i = 0; i < parti.length; i++) {
        const pathParziale = parti.slice(0, i + 1).join(' > ');
        categorieUniche.add(pathParziale);
      }
    }

    console.log(`📊 Trovate ${categorieUniche.size} categorie uniche da migrare`);

    // Crea le categorie nella nuova tabella
    const categorieOrganizzate = Array.from(categorieUniche).sort();
    const categorieMap = new Map();

    for (const categoriaPath of categorieOrganizzate) {
      const parti = categoriaPath.split(' > ');
      const nome = parti[parti.length - 1];
      const parentPath = parti.length > 1 ? parti.slice(0, -1).join(' > ') : null;
      const parentId = parentPath ? categorieMap.get(parentPath) : null;

      // Controlla se esiste già
      const categoriaEsistente = await prisma.categoriaGestione.findFirst({
        where: { nome, parentId: parentId || null }
      });

      if (!categoriaEsistente) {
        console.log(`➕ Creando categoria: ${categoriaPath}`);
        
        // Determina il livello
        let livello = 1;
        if (parentId) {
          const parent = await prisma.categoriaGestione.findUnique({
            where: { id: parentId }
          });
          if (parent) {
            livello = parent.livello + 1;
          }
        }

        // Trova il prossimo ordinamento disponibile
        const ultimaCategoria = await prisma.categoriaGestione.findFirst({
          where: { parentId: parentId || null },
          orderBy: { ordinamento: 'desc' }
        });

        const ordinamento = (ultimaCategoria?.ordinamento ?? 0) + 1;

        const nuovaCategoria = await prisma.categoriaGestione.create({
          data: {
            nome,
            nomeDisplay: nome,
            parentId,
            livello,
            ordinamento,
            emoji: getCategoryEmoji(nome),
            prodottiCount: 0,
            prodottiDirettiCount: 0
          }
        });
        
        categorieMap.set(categoriaPath, nuovaCategoria.id);
      } else {
        categorieMap.set(categoriaPath, categoriaEsistente.id);
      }
    }

    console.log('🔄 Aggiornamento contatori prodotti...');
    
    // Aggiorna i contatori per ogni categoria
    const categorieFinali = await prisma.categoriaGestione.findMany();
    const categorieMapById = new Map(categorieFinali.map(c => [c.id, c]));
    
    for (const categoria of categorieFinali) {
      const fullPath = buildFullPath(categoria, categorieMapById);
      
      // Conta prodotti totali (incluse sottocategorie)
      const prodottiTotali = await prisma.prodotto.count({
        where: {
          categoria: {
            startsWith: fullPath
          },
          isDeleted: false
        }
      });

      // Conta prodotti diretti (solo in questa categoria)
      const prodottiDiretti = await prisma.prodotto.count({
        where: {
          categoria: fullPath,
          isDeleted: false
        }
      });

      // Aggiorna i contatori
      await prisma.categoriaGestione.update({
        where: { id: categoria.id },
        data: {
          prodottiCount: prodottiTotali,
          prodottiDirettiCount: prodottiDiretti
        }
      });
    }

    return {
      success: true,
      message: `Migrate ${categorieOrganizzate.length} categorie alla nuova struttura`
    };
  } catch (error) {
    console.error("Errore migrazione categorie:", error);
    return {
      success: false,
      error: "Errore durante la migrazione delle categorie"
    };
  }
}

async function main() {
  console.log('🚀 Avvio migrazione categorie esistenti...');
  
  try {
    const result = await migraCategorieEsistenti();
    
    if (result.success) {
      console.log('✅ Migrazione completata:', result.message);
    } else {
      console.error('❌ Errore migrazione:', result.error);
    }
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);