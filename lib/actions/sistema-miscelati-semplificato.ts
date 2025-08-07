'use server';

import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-multi-tenant';
import { Decimal } from '@prisma/client/runtime/library';
import { revalidatePath } from 'next/cache';

// ========================================
// TIPI
// ========================================

export interface CategoriaIngredienteData {
  id?: string;
  nome: string;
  descrizione?: string;
  icona?: string;
  colore?: string;
  tipo: 'ALCOLICO' | 'MIXER' | 'SCIROPPO' | 'SUCCO' | 'GARNISH' | 'BITTER' | 'LIQUORE' | 'ALTRO';
  ordinamento?: number;
  attivo?: boolean;
}

export interface BottigliaData {
  id?: string;
  categoriaId: string;
  nome: string;
  marca?: string;
  descrizione?: string;
  gradazioneAlcolica?: number;
  costoPorzione?: number;  // Costo per porzione standard
  mlPorzione?: number;     // ML per porzione (40 per alcolici, 200 per mixer, etc)
  disponibile?: boolean;
  ordinamento?: number;
  prodottoRiferimentoId?: number;
  immagine?: string;
}

export interface RicettaMiscelataData {
  id?: string;
  prodottoId?: number;
  nome: string;
  descrizione?: string;
  istruzioni?: string;
  componenteBaseId?: string;
  bicchiere?: string;
  ghiaccio?: boolean;
  componenti: ComponenteMiscelatoData[];
  prezzoVendita?: number;
  margineExtra?: number;
}

export interface ComponenteMiscelatoData {
  categoriaId: string;
  obbligatorio: boolean;
  quantitaML?: number;
  proporzione?: string;
  note?: string;
  maxSelezioni?: number;
  bottiglieBaseIds?: string[];
}

// ========================================
// CATEGORIE INGREDIENTI
// ========================================

export async function getCategorieIngredienti() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return { success: false, error: 'Non autorizzato' };
    }

    const categorie = await db.categoriaIngrediente.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      include: {
        _count: {
          select: { Bottiglie: true }
        }
      }
    });

    return { success: true, data: categorie };
  } catch (error) {
    console.error('Errore recupero categorie:', error);
    return { success: false, error: 'Errore nel recupero delle categorie' };
  }
}

export async function saveCategoriaIngrediente(data: CategoriaIngredienteData) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    let categoria;
    if (data.id) {
      categoria = await db.categoriaIngrediente.update({
        where: { id: data.id },
        data: {
          nome: data.nome,
          descrizione: data.descrizione,
          icona: data.icona,
          colore: data.colore,
          tipo: data.tipo as any,
          ordinamento: data.ordinamento || 0,
          attivo: data.attivo ?? true,
          updatedAt: new Date()
        }
      });
    } else {
      categoria = await db.categoriaIngrediente.create({
        data: {
          nome: data.nome,
          descrizione: data.descrizione,
          icona: data.icona,
          colore: data.colore,
          tipo: data.tipo as any,
          ordinamento: data.ordinamento || 0,
          attivo: data.attivo ?? true
        }
      });
    }

    revalidatePath('/dashboard/miscelati/categorie');
    return { success: true, data: categoria };
  } catch (error) {
    console.error('Errore salvataggio categoria:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

export async function deleteCategoriaIngrediente(id: string) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    // Verifica se la categoria ha bottiglie
    const bottiglie = await db.bottiglia.findFirst({
      where: { categoriaId: id }
    });

    if (bottiglie) {
      return { success: false, error: 'Impossibile eliminare: categoria contiene bottiglie' };
    }

    // Verifica se la categoria è usata in ricette
    const componenti = await db.componenteMiscelato.findFirst({
      where: { categoriaId: id }
    });

    if (componenti) {
      return { success: false, error: 'Impossibile eliminare: categoria utilizzata in ricette' };
    }

    await db.categoriaIngrediente.delete({
      where: { id }
    });

    revalidatePath('/dashboard/miscelati/categorie');
    return { success: true };
  } catch (error) {
    console.error('Errore eliminazione categoria:', error);
    return { success: false, error: 'Errore nell\'eliminazione' };
  }
}

// ========================================
// BOTTIGLIE
// ========================================

export async function getBottiglie(categoriaId?: string) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return { success: false, error: 'Non autorizzato' };
    }

    const where = categoriaId ? { categoriaId, disponibile: true } : { disponibile: true };
    
    const bottiglie = await db.bottiglia.findMany({
      where,
      orderBy: [
        { categoria: { ordinamento: 'asc' } },
        { ordinamento: 'asc' },
        { nome: 'asc' }
      ],
      include: {
        categoria: true,
        prodotto: {
          select: {
            id: true,
            nome: true,
            disponibile: true
          }
        }
      }
    });

    // Converti i Decimal in numeri per i Client Components
    const bottiglieSerializzate = bottiglie.map(b => ({
      ...b,
      gradazioneAlcolica: b.gradazioneAlcolica ? b.gradazioneAlcolica.toNumber() : null,
      costoPorzione: b.costoPorzione.toNumber()
    }));

    return { success: true, data: bottiglieSerializzate };
  } catch (error) {
    console.error('Errore recupero bottiglie:', error);
    return { success: false, error: 'Errore nel recupero delle bottiglie' };
  }
}

export async function saveBottiglia(data: BottigliaData) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    let bottiglia;
    
    if (data.id) {
      // Per l'update, non includiamo categoriaId se non è cambiato
      bottiglia = await db.bottiglia.update({
        where: { id: data.id },
        data: {
          nome: data.nome,
          marca: data.marca,
          descrizione: data.descrizione,
          gradazioneAlcolica: data.gradazioneAlcolica ? new Decimal(data.gradazioneAlcolica) : null,
          costoPorzione: new Decimal(data.costoPorzione || 0),
          mlPorzione: data.mlPorzione || 40,
          disponibile: data.disponibile ?? true,
          ordinamento: data.ordinamento || 0,
          prodottoRiferimentoId: data.prodottoRiferimentoId || null,
          immagine: data.immagine,
          ...(data.categoriaId && { categoriaId: data.categoriaId })
        }
      });
    } else {
      // Per il create, usiamo categoriaId direttamente
      bottiglia = await db.bottiglia.create({
        data: {
          categoriaId: data.categoriaId,
          nome: data.nome,
          marca: data.marca,
          descrizione: data.descrizione,
          gradazioneAlcolica: data.gradazioneAlcolica ? new Decimal(data.gradazioneAlcolica) : null,
          costoPorzione: new Decimal(data.costoPorzione || 0),
          mlPorzione: data.mlPorzione || 40,
          disponibile: data.disponibile ?? true,
          ordinamento: data.ordinamento || 0,
          prodottoRiferimentoId: data.prodottoRiferimentoId,
          immagine: data.immagine
        }
      });
    }

    revalidatePath('/dashboard/miscelati/bottiglie');
    return { success: true, data: bottiglia };
  } catch (error) {
    console.error('Errore salvataggio bottiglia:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

export async function deleteBottiglia(id: string) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    // Verifica se la bottiglia è usata in qualche ricetta
    const selezioni = await db.selezioneBottiglia.findFirst({
      where: { bottigliaId: id }
    });

    if (selezioni) {
      return { success: false, error: 'Impossibile eliminare: bottiglia utilizzata in ricette' };
    }

    await db.bottiglia.delete({
      where: { id }
    });

    revalidatePath('/dashboard/miscelati/bottiglie');
    return { success: true };
  } catch (error) {
    console.error('Errore eliminazione bottiglia:', error);
    return { success: false, error: 'Errore nell\'eliminazione' };
  }
}

// ========================================
// RICETTE MISCELATE
// ========================================

export async function getRicetteMiscelate() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return { success: false, error: 'Non autorizzato' };
    }

    const ricette = await db.ricettaMiscelata.findMany({
      include: {
        prodotto: true,
        componenteBase: {
          include: {
            categoria: true
          }
        },
        Componenti: {
          orderBy: { ordinamento: 'asc' },
          include: {
            categoria: true
          }
        }
      },
      orderBy: { nome: 'asc' }
    });

    // Converti i Decimal in numeri per i Client Components
    const ricetteSerializzate = ricette.map(r => ({
      ...r,
      prezzoVendita: r.prezzoVendita.toNumber(),
      margineExtra: r.margineExtra.toNumber(),
      prodotto: {
        ...r.prodotto,
        prezzo: r.prodotto.prezzo.toNumber()
      },
      componenteBase: r.componenteBase ? {
        ...r.componenteBase,
        gradazioneAlcolica: r.componenteBase.gradazioneAlcolica ? r.componenteBase.gradazioneAlcolica.toNumber() : null,
        costoPorzione: r.componenteBase.costoPorzione.toNumber()
      } : null
    }));

    return { success: true, data: ricetteSerializzate };
  } catch (error) {
    console.error('Errore recupero ricette:', error);
    return { success: false, error: 'Errore nel recupero delle ricette' };
  }
}

// Funzione helper per calcolare il prezzo base della ricetta
async function calcolaPrezzoBase(componenti: ComponenteMiscelatoData[], tx: any) {
  let prezzoBase = new Decimal(0);
  
  for (const comp of componenti) {
    if (comp.bottiglieBaseIds && comp.bottiglieBaseIds.length > 0) {
      // Usa le bottiglie base selezionate
      for (const bottigliaId of comp.bottiglieBaseIds) {
        const bottiglia = await tx.bottiglia.findUnique({
          where: { id: bottigliaId }
        });
        
        if (bottiglia) {
          if (comp.quantitaML && bottiglia.mlPorzione) {
            const numPorzioni = comp.quantitaML / bottiglia.mlPorzione;
            prezzoBase = prezzoBase.add(bottiglia.costoPorzione.mul(numPorzioni));
          } else {
            prezzoBase = prezzoBase.add(bottiglia.costoPorzione);
          }
        }
      }
    } else {
      // Se non ci sono bottiglie base, usa la più economica della categoria
      const bottigliaEconomica = await tx.bottiglia.findFirst({
        where: { 
          categoriaId: comp.categoriaId,
          disponibile: true
        },
        orderBy: { costoPorzione: 'asc' }
      });
      
      if (bottigliaEconomica) {
        if (comp.quantitaML && bottigliaEconomica.mlPorzione) {
          const numPorzioni = comp.quantitaML / bottigliaEconomica.mlPorzione;
          prezzoBase = prezzoBase.add(bottigliaEconomica.costoPorzione.mul(numPorzioni));
        } else {
          prezzoBase = prezzoBase.add(bottigliaEconomica.costoPorzione);
        }
      }
    }
  }
  
  return prezzoBase;
}

export async function saveRicettaMiscelata(data: RicettaMiscelataData) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    const result = await db.$transaction(async (tx) => {
      // Calcola il prezzo base in base alle bottiglie selezionate
      const prezzoBase = await calcolaPrezzoBase(data.componenti, tx);
      
      // Il prezzo nel menu è SEMPRE: costo ingredienti base + margine
      const prezzoMenu = prezzoBase.add(data.margineExtra || 0);
      
      // Crea o aggiorna il prodotto base
      let prodotto;
      if (data.prodottoId) {
        prodotto = await tx.prodotto.update({
          where: { id: data.prodottoId },
          data: {
            nome: data.nome,
            descrizione: data.descrizione,
            prezzo: prezzoMenu,
            categoria: 'COCKTAIL',
            postazione: 'BANCO',
            isMiscelato: true,
            updatedAt: new Date()
          }
        });
      } else {
        prodotto = await tx.prodotto.create({
          data: {
            nome: data.nome,
            descrizione: data.descrizione,
            prezzo: prezzoMenu,
            categoria: 'COCKTAIL',
            postazione: 'BANCO',
            disponibile: true,
            isMiscelato: true,
            isDeleted: false,
            updatedAt: new Date()
          }
        });
      }

      // Crea o aggiorna la ricetta
      let ricetta;
      if (data.id) {
        // Elimina componenti esistenti
        await tx.componenteMiscelato.deleteMany({
          where: { ricettaId: data.id }
        });

        ricetta = await tx.ricettaMiscelata.update({
          where: { id: data.id },
          data: {
            nome: data.nome,
            descrizione: data.descrizione,
            istruzioni: data.istruzioni,
            componenteBaseId: data.componenteBaseId,
            bicchiere: data.bicchiere,
            ghiaccio: data.ghiaccio ?? true,
            prezzoVendita: new Decimal(0), // Non più usato, sempre 0
            margineExtra: data.margineExtra ? new Decimal(data.margineExtra) : new Decimal(0),
            updatedAt: new Date()
          }
        });
      } else {
        ricetta = await tx.ricettaMiscelata.create({
          data: {
            prodottoId: prodotto.id,
            nome: data.nome,
            descrizione: data.descrizione,
            istruzioni: data.istruzioni,
            componenteBaseId: data.componenteBaseId,
            bicchiere: data.bicchiere,
            ghiaccio: data.ghiaccio ?? true,
            prezzoVendita: new Decimal(0), // Non più usato, sempre 0
            margineExtra: data.margineExtra ? new Decimal(data.margineExtra) : new Decimal(0)
          }
        });
      }

      // Crea i nuovi componenti
      for (let i = 0; i < data.componenti.length; i++) {
        const comp = data.componenti[i];
        await tx.componenteMiscelato.create({
          data: {
            ricettaId: ricetta.id,
            categoriaId: comp.categoriaId,
            obbligatorio: comp.obbligatorio,
            quantitaML: comp.quantitaML,
            proporzione: comp.proporzione,
            note: comp.note,
            maxSelezioni: comp.maxSelezioni || 1,
            bottiglieBaseIds: comp.bottiglieBaseIds || [],
            ordinamento: i
          }
        });
      }

      return { prodotto, ricetta };
    });

    revalidatePath('/dashboard/miscelati/ricette');
    revalidatePath('/dashboard/products');
    return { success: true, data: result };
  } catch (error) {
    console.error('Errore salvataggio ricetta:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

// ========================================
// FUNZIONI PER INTERFACCIA CAMERIERE
// ========================================

export async function getRicettaByProdottoId(prodottoId: number) {
  try {
    const ricetta = await db.ricettaMiscelata.findUnique({
      where: { prodottoId },
      include: {
        prodotto: true,
        componenteBase: true,
        Componenti: {
          orderBy: { ordinamento: 'asc' },
          include: {
            categoria: true
          }
        }
      }
    });

    if (!ricetta) {
      return { success: false, error: 'Ricetta non trovata' };
    }

    // Converti Decimal in numeri
    const ricettaSerializzata = {
      ...ricetta,
      prezzoVendita: ricetta.prezzoVendita.toNumber(),
      margineExtra: ricetta.margineExtra.toNumber(),
      prodotto: {
        ...ricetta.prodotto,
        prezzo: ricetta.prodotto.prezzo.toNumber()
      }
    };

    return { success: true, data: ricettaSerializzata };
  } catch (error) {
    console.error('Errore recupero ricetta:', error);
    return { success: false, error: 'Errore nel recupero della ricetta' };
  }
}

export async function getBottigliePerCategoria(categoriaId: string) {
  try {
    const bottiglie = await db.bottiglia.findMany({
      where: { 
        categoriaId,
        disponibile: true 
      },
      orderBy: [
        { ordinamento: 'asc' },
        { nome: 'asc' }
      ]
    });

    // Converti Decimal in numeri
    const bottiglieSerializzate = bottiglie.map(b => ({
      ...b,
      gradazioneAlcolica: b.gradazioneAlcolica ? b.gradazioneAlcolica.toNumber() : null,
      costoPorzione: b.costoPorzione.toNumber()
    }));

    return { success: true, data: bottiglieSerializzate };
  } catch (error) {
    console.error('Errore recupero bottiglie:', error);
    return { success: false, error: 'Errore nel recupero delle bottiglie' };
  }
}

// ========================================
// FUNZIONI HELPER PER ORDINAZIONE
// ========================================

export async function calcolaPrezzoMiscelato(
  ricettaId: string,
  selezioniBottiglie: { categoriaId: string; bottigliaId: string }[]
) {
  try {
    const ricetta = await db.ricettaMiscelata.findUnique({
      where: { id: ricettaId },
      include: {
        prodotto: true,
        Componenti: true
      }
    });

    if (!ricetta) {
      throw new Error('Ricetta non trovata');
    }

    // Calcola il costo totale basato sui costi per porzione
    let costoTotale = new Decimal(0);

    for (const selezione of selezioniBottiglie) {
      const bottiglia = await db.bottiglia.findUnique({
        where: { id: selezione.bottigliaId }
      });

      if (bottiglia) {
        // Trova il componente corrispondente per sapere quante porzioni servono
        const componente = ricetta.Componenti.find(c => c.categoriaId === selezione.categoriaId);
        if (componente) {
          // Se è specificata la quantità in ML, calcola quante porzioni servono
          if (componente.quantitaML && bottiglia.mlPorzione) {
            const numPorzioni = componente.quantitaML / bottiglia.mlPorzione;
            const costoIngrediente = bottiglia.costoPorzione.mul(numPorzioni);
            costoTotale = costoTotale.add(costoIngrediente);
          } else {
            // Altrimenti usa una porzione standard
            costoTotale = costoTotale.add(bottiglia.costoPorzione);
          }
        }
      }
    }

    // Il prezzo è SEMPRE: costo ingredienti + margine
    const prezzoFinale = costoTotale.add(ricetta.margineExtra || 0);
    
    return prezzoFinale;
  } catch (error) {
    console.error('Errore calcolo prezzo:', error);
    throw error;
  }
}

// ========================================
// DATI DI ESEMPIO PER INIZIALIZZAZIONE
// ========================================

export async function inizializzaDatiEsempio() {
  try {
    const session = await getCurrentUser();
    if (!session || session.ruolo !== 'ADMIN') {
      return { success: false, error: 'Solo gli admin possono inizializzare i dati' };
    }

    await db.$transaction(async (tx) => {
      // Crea categorie base
      const categorie = await Promise.all([
        tx.categoriaIngrediente.create({
          data: {
            nome: 'GIN',
            descrizione: 'Selezione di Gin Premium',
            icona: '🍸',
            colore: '#3B82F6',
            tipo: 'ALCOLICO',
            ordinamento: 1
          }
        }),
        tx.categoriaIngrediente.create({
          data: {
            nome: 'VODKA',
            descrizione: 'Vodka Premium',
            icona: '🥃',
            colore: '#6366F1',
            tipo: 'ALCOLICO',
            ordinamento: 2
          }
        }),
        tx.categoriaIngrediente.create({
          data: {
            nome: 'RUM',
            descrizione: 'Rum Caraibici e Speziati',
            icona: '🏝️',
            colore: '#A16207',
            tipo: 'ALCOLICO',
            ordinamento: 3
          }
        }),
        tx.categoriaIngrediente.create({
          data: {
            nome: 'TONICHE',
            descrizione: 'Acque Toniche Premium',
            icona: '💧',
            colore: '#06B6D4',
            tipo: 'MIXER',
            ordinamento: 10
          }
        }),
        tx.categoriaIngrediente.create({
          data: {
            nome: 'SODA',
            descrizione: 'Soda e Ginger Beer',
            icona: '🥤',
            colore: '#10B981',
            tipo: 'MIXER',
            ordinamento: 11
          }
        }),
        tx.categoriaIngrediente.create({
          data: {
            nome: 'GARNISH',
            descrizione: 'Decorazioni e Aromi',
            icona: '🌿',
            colore: '#84CC16',
            tipo: 'GARNISH',
            ordinamento: 20
          }
        })
      ]);

      // Trova le categorie create
      const catGin = categorie.find(c => c.nome === 'GIN')!;
      const catVodka = categorie.find(c => c.nome === 'VODKA')!;
      const catToniche = categorie.find(c => c.nome === 'TONICHE')!;
      const catGarnish = categorie.find(c => c.nome === 'GARNISH')!;

      // Crea bottiglie GIN
      await Promise.all([
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Bombay Sapphire',
            marca: 'Bombay',
            gradazioneAlcolica: new Decimal(47),
            costoPorzione: new Decimal(1),  // €1 per 40ml
            mlPorzione: 40,
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Hendricks',
            marca: 'Hendricks',
            gradazioneAlcolica: new Decimal(44),
            costoPorzione: new Decimal(1.4),  // €1.40 per 40ml
            mlPorzione: 40,
            ordinamento: 2
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Tanqueray',
            marca: 'Tanqueray',
            gradazioneAlcolica: new Decimal(43.1),
            costoPorzione: new Decimal(1.1),  // €1.10 per 40ml
            mlPorzione: 40,
            ordinamento: 3
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Gin Mare',
            marca: 'Gin Mare',
            gradazioneAlcolica: new Decimal(42.7),
            costoPorzione: new Decimal(1.8),  // €1.80 per 40ml
            mlPorzione: 40,
            ordinamento: 4
          }
        })
      ]);

      // Crea bottiglie VODKA
      await Promise.all([
        tx.bottiglia.create({
          data: {
            categoriaId: catVodka.id,
            nome: 'Grey Goose',
            marca: 'Grey Goose',
            gradazioneAlcolica: new Decimal(40),
            costoPorzione: new Decimal(1.6),  // €1.60 per 40ml
            mlPorzione: 40,
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catVodka.id,
            nome: 'Belvedere',
            marca: 'Belvedere',
            gradazioneAlcolica: new Decimal(40),
            costoPorzione: new Decimal(1.7),  // €1.70 per 40ml
            mlPorzione: 40,
            ordinamento: 2
          }
        })
      ]);

      // Crea toniche
      await Promise.all([
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: 'Schweppes Tonica',
            marca: 'Schweppes',
            costoPorzione: new Decimal(0.6),  // €0.60 per 200ml
            mlPorzione: 200,
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: 'Fever-Tree',
            marca: 'Fever-Tree',
            costoPorzione: new Decimal(1.6),  // €1.60 per 200ml
            mlPorzione: 200,
            ordinamento: 2
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: '1724',
            marca: '1724',
            costoPorzione: new Decimal(2.4),  // €2.40 per 200ml
            mlPorzione: 200,
            ordinamento: 3
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: 'Thomas Henry',
            marca: 'Thomas Henry',
            costoPorzione: new Decimal(1.2),  // €1.20 per 200ml
            mlPorzione: 200,
            ordinamento: 4
          }
        })
      ]);

      // Crea garnish
      await Promise.all([
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Lime',
            costoPorzione: new Decimal(0.1),  // €0.10 per garnish
            mlPorzione: 1,  // Garnish conta come pezzo
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Cetriolo',
            costoPorzione: new Decimal(0.2),  // €0.20 per garnish
            mlPorzione: 1,
            ordinamento: 2
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Rosmarino',
            costoPorzione: new Decimal(0.2),  // €0.20 per garnish
            mlPorzione: 1,
            ordinamento: 3
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Bacche di Ginepro',
            costoPorzione: new Decimal(0.3),  // €0.30 per garnish
            mlPorzione: 1,
            ordinamento: 4
          }
        })
      ]);
    });

    revalidatePath('/dashboard/miscelati');
    return { success: true, message: 'Dati di esempio inizializzati con successo' };
  } catch (error) {
    console.error('Errore inizializzazione dati:', error);
    return { success: false, error: 'Errore nell\'inizializzazione dei dati' };
  }
}