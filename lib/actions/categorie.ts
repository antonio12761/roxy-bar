"use server";

import { prisma } from "@/lib/db";

// Helper functions per gestire la gerarchia
function parseCategory(categoria: string) {
  const parts = categoria.split(' > ');
  return {
    principale: parts[0],
    sottocategoria: parts[1] || null,
    fullPath: categoria
  };
}

function buildCategoryTree(categorie: string[]) {
  const tree: { [key: string]: { sottocategorie: string[], count: number } } = {};
  
  categorie.forEach(categoria => {
    const parsed = parseCategory(categoria);
    
    if (!tree[parsed.principale]) {
      tree[parsed.principale] = { sottocategorie: [], count: 0 };
    }
    
    if (parsed.sottocategoria) {
      if (!tree[parsed.principale].sottocategorie.includes(parsed.sottocategoria)) {
        tree[parsed.principale].sottocategorie.push(parsed.sottocategoria);
      }
    }
  });
  
  return tree;
}

export async function getCategorie() {
  try {
    // Ottieni tutte le categorie uniche dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      select: {
        categoria: true
      },
      distinct: ['categoria'],
      where: {
        isDeleted: false
      }
    });

    // Conta i prodotti per categoria
    const categorieWithCount = await Promise.all(
      prodotti.map(async (p) => {
        const count = await prisma.prodotto.count({
          where: {
            categoria: p.categoria,
            isDeleted: false
          }
        });
        return {
          nome: p.categoria,
          prodottiCount: count,
          parsed: parseCategory(p.categoria)
        };
      })
    );

    return categorieWithCount.sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (error) {
    console.error("Errore recupero categorie:", error);
    return [];
  }
}

export async function getCategorieGerarchiche() {
  try {
    // Ottieni categorie sia da prodotti attivi che da placeholder per categorie vuote
    const prodotti = await prisma.prodotto.findMany({
      select: {
        categoria: true
      },
      distinct: ['categoria']
      // Non filtriamo isDeleted qui perché vogliamo includere anche i placeholder
    });

    const categorieFlat = prodotti.map(p => p.categoria);
    const tree = buildCategoryTree(categorieFlat);
    
    // Conta i prodotti per ogni categoria principale e sottocategoria
    const categorieGerarchiche = await Promise.all(
      Object.keys(tree).map(async (catPrincipale) => {
        // Conta prodotti nella categoria principale (incluse sottocategorie)
        const countTotale = await prisma.prodotto.count({
          where: {
            categoria: {
              startsWith: catPrincipale
            },
            isDeleted: false
          }
        });

        // Conta prodotti solo nella categoria principale (senza sottocategorie)
        const countPrincipale = await prisma.prodotto.count({
          where: {
            categoria: catPrincipale,
            isDeleted: false
          }
        });

        const sottocategorie = await Promise.all(
          tree[catPrincipale].sottocategorie.map(async (sub) => {
            const countSub = await prisma.prodotto.count({
              where: {
                categoria: `${catPrincipale} > ${sub}`,
                isDeleted: false
              }
            });
            return {
              nome: sub,
              fullPath: `${catPrincipale} > ${sub}`,
              prodottiCount: countSub
            };
          })
        );

        return {
          nome: catPrincipale,
          prodottiCount: countTotale,
          prodottiDiretti: countPrincipale,
          sottocategorie: sottocategorie.sort((a, b) => a.nome.localeCompare(b.nome))
        };
      })
    );

    return categorieGerarchiche.sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (error) {
    console.error("Errore recupero categorie gerarchiche:", error);
    return [];
  }
}

export async function rinominaCategoria(vecchioNome: string, nuovoNome: string) {
  try {
    // Aggiorna tutti i prodotti con la vecchia categoria
    const result = await prisma.prodotto.updateMany({
      where: {
        categoria: vecchioNome,
        isDeleted: false
      },
      data: {
        categoria: nuovoNome
      }
    });

    return {
      success: true,
      count: result.count,
      message: `Aggiornati ${result.count} prodotti`
    };
  } catch (error) {
    console.error("Errore rinomina categoria:", error);
    return {
      success: false,
      error: "Errore durante la rinomina della categoria"
    };
  }
}

export async function getProdottiByCategoria(categoria: string) {
  try {
    const prodotti = await prisma.prodotto.findMany({
      where: {
        categoria,
        isDeleted: false
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Converti Decimal in number per il client
    return prodotti.map(prodotto => ({
      ...prodotto,
      prezzo: prodotto.prezzo.toNumber(),
      calorie: prodotto.calorie
    }));
  } catch (error) {
    console.error("Errore recupero prodotti:", error);
    return [];
  }
}

export async function spostaProddottiCategoria(prodottiIds: number[], nuovaCategoria: string) {
  try {
    const result = await prisma.prodotto.updateMany({
      where: {
        id: {
          in: prodottiIds
        },
        isDeleted: false
      },
      data: {
        categoria: nuovaCategoria
      }
    });

    return {
      success: true,
      count: result.count,
      message: `Spostati ${result.count} prodotti in ${nuovaCategoria}`
    };
  } catch (error) {
    console.error("Errore spostamento prodotti:", error);
    return {
      success: false,
      error: "Errore durante lo spostamento dei prodotti"
    };
  }
}

export async function unisciCategorie(categoriaOrigine: string, categoriaDestinazione: string) {
  try {
    // Sposta tutti i prodotti dalla categoria origine alla postazione
    const result = await prisma.prodotto.updateMany({
      where: {
        categoria: categoriaOrigine,
        isDeleted: false
      },
      data: {
        categoria: categoriaDestinazione
      }
    });

    return {
      success: true,
      count: result.count,
      message: `Uniti ${result.count} prodotti da ${categoriaOrigine} a ${categoriaDestinazione}`
    };
  } catch (error) {
    console.error("Errore unione categorie:", error);
    return {
      success: false,
      error: "Errore durante l'unione delle categorie"
    };
  }
}

export async function creaCategoria(nomeCategoria: string, categoriaPadre?: string) {
  try {
    const nomeCompleto = categoriaPadre ? `${categoriaPadre} > ${nomeCategoria}` : nomeCategoria;
    
    // Controlla se la categoria esiste già
    const categoriaEsistente = await prisma.prodotto.findFirst({
      where: {
        categoria: nomeCompleto,
        isDeleted: false
      }
    });

    if (categoriaEsistente) {
      return {
        success: false,
        error: "Categoria già esistente"
      };
    }

    // Crea un prodotto placeholder per rendere visibile la categoria
    await prisma.prodotto.create({
      data: {
        nome: `_CATEGORIA_PLACEHOLDER_${nomeCompleto}`,
        categoria: nomeCompleto,
        prezzo: 0,
        disponibile: false,
        isDeleted: true, // Lo marchiamo come eliminato così non appare nei menu
        descrizione: "Placeholder per categoria vuota - non eliminare",
        postazione: "PREPARA",
        terminato: false,
        glutenFree: false,
        vegano: false,
        vegetariano: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      message: categoriaPadre 
        ? `Sottocategoria "${nomeCategoria}" creata in "${categoriaPadre}".`
        : `Categoria "${nomeCategoria}" creata.`,
      categoria: nomeCompleto
    };
  } catch (error) {
    console.error("Errore creazione categoria:", error);
    return {
      success: false,
      error: "Errore durante la creazione della categoria"
    };
  }
}

export async function creaSottocategoria(categoriaPrincipale: string, nomeSottocategoria: string) {
  return creaCategoria(nomeSottocategoria, categoriaPrincipale);
}

// Funzione per ottenere tutte le categorie, incluse quelle create ma vuote
export async function getAllCategorieNomi() {
  try {
    const categorieConProdotti = await prisma.prodotto.findMany({
      where: {
        isDeleted: false
      },
      select: {
        categoria: true
      },
      distinct: ['categoria']
    });

    return categorieConProdotti.map(p => p.categoria).sort();
  } catch (error) {
    console.error("Errore recupero nomi categorie:", error);
    return [];
  }
}

export async function eliminaCategoria(nomeCategoria: string) {
  try {
    // Controlla se ci sono prodotti reali in questa categoria
    const prodottiReali = await prisma.prodotto.findMany({
      where: {
        categoria: nomeCategoria,
        isDeleted: false,
        NOT: {
          nome: {
            startsWith: "_CATEGORIA_PLACEHOLDER_"
          }
        }
      }
    });

    if (prodottiReali.length > 0) {
      // Sposta i prodotti in "Non categorizzato" invece di bloccare l'eliminazione
      await prisma.prodotto.updateMany({
        where: {
          categoria: nomeCategoria,
          isDeleted: false,
          NOT: {
            nome: {
              startsWith: "_CATEGORIA_PLACEHOLDER_"
            }
          }
        },
        data: {
          categoria: "Non categorizzato"
        }
      });
    }

    // Elimina il placeholder se esiste
    await prisma.prodotto.deleteMany({
      where: {
        categoria: nomeCategoria,
        nome: `_CATEGORIA_PLACEHOLDER_${nomeCategoria}`
      }
    });

    // Se ci sono sottocategorie, gestiscile
    const sottocategorie = await prisma.prodotto.findMany({
      where: {
        categoria: {
          startsWith: `${nomeCategoria} > `
        }
      },
      select: {
        categoria: true,
        nome: true,
        isDeleted: true
      },
      distinct: ['categoria']
    });

    for (const sub of sottocategorie) {
      // Sposta i prodotti reali delle sottocategorie
      if (!sub.nome.startsWith("_CATEGORIA_PLACEHOLDER_")) {
        await prisma.prodotto.updateMany({
          where: {
            categoria: sub.categoria,
            isDeleted: false,
            NOT: {
              nome: {
                startsWith: "_CATEGORIA_PLACEHOLDER_"
              }
            }
          },
          data: {
            categoria: "Non categorizzato"
          }
        });
      }
      
      // Elimina i placeholder delle sottocategorie
      await prisma.prodotto.deleteMany({
        where: {
          categoria: sub.categoria,
          nome: `_CATEGORIA_PLACEHOLDER_${sub.categoria}`
        }
      });
    }

    const message = prodottiReali.length > 0 
      ? `Categoria "${nomeCategoria}" eliminata. ${prodottiReali.length} prodotti spostati in "Non categorizzato"`
      : `Categoria "${nomeCategoria}" eliminata`;

    return {
      success: true,
      message: message
    };
  } catch (error) {
    console.error("Errore eliminazione categoria:", error);
    return {
      success: false,
      error: "Errore durante l'eliminazione della categoria"
    };
  }
}