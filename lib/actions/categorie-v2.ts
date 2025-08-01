"use server";

import { prisma } from "@/lib/db";

// Interfacce TypeScript
interface CategoriaGerarchicaV2 {
  id: number;
  nome: string;
  nomeDisplay?: string;
  parentId?: number;
  livello: number;
  ordinamento: number;
  emoji?: string;
  colore?: string;
  descrizione?: string;
  attiva: boolean;
  prodottiCount: number;
  prodottiDirettiCount: number;
  children: CategoriaGerarchicaV2[];
  fullPath: string;
}

// Helper per costruire il path completo
function buildFullPath(categoria: any, categorieMap: Map<number, any>): string {
  if (!categoria.parentId) {
    return categoria.nome;
  }
  const parent = categorieMap.get(categoria.parentId);
  if (!parent) {
    return categoria.nome;
  }
  return `${buildFullPath(parent, categorieMap)} > ${categoria.nome}`;
}

// Ottieni tutte le categorie con struttura gerarchica
export async function getCategorieGerarchicheV2(): Promise<CategoriaGerarchicaV2[]> {
  try {
    const categorie = await prisma.categoriaGestione.findMany({
      where: { attiva: true },
      orderBy: [
        { livello: 'asc' },
        { ordinamento: 'asc' },
        { nome: 'asc' }
      ]
    });

    // Crea mappa per lookup veloce
    const categorieMap = new Map(categorie.map(cat => [cat.id, cat]));

    // Aggiorna contatori prodotti in tempo reale
    for (const categoria of categorie) {
      const fullPath = buildFullPath(categoria, categorieMap);
      
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

      // Aggiorna i contatori cache se necessario
      if (categoria.prodottiCount !== prodottiTotali || categoria.prodottiDirettiCount !== prodottiDiretti) {
        await prisma.categoriaGestione.update({
          where: { id: categoria.id },
          data: {
            prodottiCount: prodottiTotali,
            prodottiDirettiCount: prodottiDiretti
          }
        });
      }
    }

    // Ricarica con i contatori aggiornati
    const categorieAggiornate = await prisma.categoriaGestione.findMany({
      where: { attiva: true },
      orderBy: [
        { livello: 'asc' },
        { ordinamento: 'asc' },
        { nome: 'asc' }
      ]
    });

    // Costruisci struttura gerarchica
    const categorieConPath = categorieAggiornate.map(cat => ({
      ...cat,
      nomeDisplay: cat.nomeDisplay || undefined,
      emoji: cat.emoji || undefined,
      colore: cat.colore || undefined,
      descrizione: cat.descrizione || undefined,
      parentId: cat.parentId || undefined,
      children: [],
      fullPath: buildFullPath(cat, new Map(categorieAggiornate.map(c => [c.id, c])))
    }));

    // Organizza in albero
    const rootCategories: CategoriaGerarchicaV2[] = [];
    const childrenMap = new Map<number, CategoriaGerarchicaV2[]>();

    for (const categoria of categorieConPath) {
      if (!categoria.parentId) {
        rootCategories.push(categoria);
      } else {
        if (!childrenMap.has(categoria.parentId)) {
          childrenMap.set(categoria.parentId, []);
        }
        childrenMap.get(categoria.parentId)!.push(categoria);
      }
    }

    // Assegna figli alle categorie padre
    const assignChildren = (categoria: CategoriaGerarchicaV2) => {
      categoria.children = childrenMap.get(categoria.id) || [];
      categoria.children.forEach(assignChildren);
    };

    rootCategories.forEach(assignChildren);

    return rootCategories;
  } catch (error) {
    console.error("Errore recupero categorie gerarchiche V2:", error);
    return [];
  }
}

// Crea nuova categoria
export async function creaCategoriaV2(
  nome: string, 
  parentId?: number, 
  options?: {
    nomeDisplay?: string;
    emoji?: string;
    colore?: string;
    descrizione?: string;
    ordinamento?: number;
  }
) {
  try {
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

    const ordinamento = options?.ordinamento ?? (ultimaCategoria?.ordinamento ?? 0) + 1;

    const nuovaCategoria = await prisma.categoriaGestione.create({
      data: {
        nome,
        nomeDisplay: options?.nomeDisplay || nome,
        parentId,
        livello,
        ordinamento,
        emoji: options?.emoji,
        colore: options?.colore,
        descrizione: options?.descrizione,
        prodottiCount: 0,
        prodottiDirettiCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      message: parentId 
        ? `Sottocategoria "${nome}" creata con successo`
        : `Categoria "${nome}" creata con successo`,
      categoria: nuovaCategoria
    };
  } catch (error) {
    console.error("Errore creazione categoria V2:", error);
    return {
      success: false,
      error: error instanceof Error && error.message.includes('unique constraint') 
        ? "Categoria già esistente" 
        : "Errore durante la creazione della categoria"
    };
  }
}

// Rinomina categoria
export async function rinominaCategoriaV2(id: number, nuovoNome: string) {
  try {
    const categoria = await prisma.categoriaGestione.findUnique({
      where: { id }
    });

    if (!categoria) {
      return { success: false, error: "Categoria non trovata" };
    }

    // Costruisci il vecchio e nuovo path
    const categorieMap = await prisma.categoriaGestione.findMany();
    const categorieMapById = new Map(categorieMap.map(c => [c.id, c]));
    
    const vecchioPath = buildFullPath(categoria, categorieMapById);
    
    // Aggiorna la categoria
    await prisma.categoriaGestione.update({
      where: { id },
      data: { 
        nome: nuovoNome,
        nomeDisplay: nuovoNome
      }
    });

    // Ricostruisci il nuovo path
    const categoriaAggiornata = { ...categoria, nome: nuovoNome };
    const nuovoPath = buildFullPath(categoriaAggiornata, categorieMapById);

    // Aggiorna tutti i prodotti che usano questo path
    // Prima trova tutti i prodotti che devono essere aggiornati
    const prodottiDaAggiornare = await prisma.prodotto.findMany({
      where: {
        categoria: {
          startsWith: vecchioPath
        }
      },
      select: {
        id: true,
        categoria: true
      }
    });

    // Aggiorna ogni prodotto con la nuova categoria
    for (const prodotto of prodottiDaAggiornare) {
      const nuovaCategoria = prodotto.categoria.replace(vecchioPath, nuovoPath);
      await prisma.prodotto.update({
        where: { id: prodotto.id },
        data: { categoria: nuovaCategoria }
      });
    }

    return {
      success: true,
      message: `Categoria rinominata da "${categoria.nome}" a "${nuovoNome}"`
    };
  } catch (error) {
    console.error("Errore rinomina categoria V2:", error);
    return {
      success: false,
      error: "Errore durante la rinomina della categoria"
    };
  }
}

// Elimina categoria
export async function eliminaCategoriaV2(id: number) {
  try {
    const categoria = await prisma.categoriaGestione.findUnique({
      where: { id },
      include: { other_CategoriaGestione: true }
    });

    if (!categoria) {
      return { success: false, error: "Categoria non trovata" };
    }

    // Controlla se ha sottocategorie
    if (categoria.other_CategoriaGestione.length > 0) {
      return {
        success: false,
        error: `Impossibile eliminare: la categoria ha ${categoria.other_CategoriaGestione.length} sottocategorie`
      };
    }

    // Controlla se ha prodotti
    if (categoria.prodottiCount > 0) {
      return {
        success: false,
        error: `Impossibile eliminare: ci sono ancora ${categoria.prodottiCount} prodotti in questa categoria`
      };
    }

    // Elimina la categoria
    await prisma.categoriaGestione.delete({
      where: { id }
    });

    return {
      success: true,
      message: `Categoria "${categoria.nome}" eliminata con successo`
    };
  } catch (error) {
    console.error("Errore eliminazione categoria V2:", error);
    return {
      success: false,
      error: "Errore durante l'eliminazione della categoria"
    };
  }
}

// Migra categorie esistenti alla nuova struttura
export async function migraCategorieEsistenti() {
  try {
    // Ottieni tutte le categorie esistenti dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      where: { isDeleted: false }
    });

    const categorieEsistenti = prodotti.map(p => p.categoria);
    const categorieUniche = new Set<string>();
    
    // Estrai tutte le categorie principali e sottocategorie
    for (const categoria of categorieEsistenti) {
      const parti = categoria.split(' > ');
      for (let i = 0; i < parti.length; i++) {
        const pathParziale = parti.slice(0, i + 1).join(' > ');
        categorieUniche.add(pathParziale);
      }
    }

    // Crea le categorie nella nuova tabella
    const categorieOrganizzate = Array.from(categorieUniche).sort();
    const categorieMap = new Map<string, number>();

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
        const result = await creaCategoriaV2(nome, parentId || undefined, {
          emoji: getCategoryEmoji(nome)
        });
        
        if (result.success && result.categoria) {
          categorieMap.set(categoriaPath, result.categoria.id);
        }
      } else {
        categorieMap.set(categoriaPath, categoriaEsistente.id);
      }
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

// Helper per emoji predefinite
function getCategoryEmoji(category: string): string {
  const emojiMap: { [key: string]: string } = {
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