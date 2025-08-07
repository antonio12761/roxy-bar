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
  prezzoExtra?: number;
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
}

export interface ComponenteMiscelatoData {
  categoriaId: string;
  obbligatorio: boolean;
  quantitaML?: number;
  proporzione?: string;
  note?: string;
  maxSelezioni?: number;
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

    return { success: true, data: bottiglie };
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
    const bottigliaData = {
      categoriaId: data.categoriaId,
      nome: data.nome,
      marca: data.marca,
      descrizione: data.descrizione,
      gradazioneAlcolica: data.gradazioneAlcolica ? new Decimal(data.gradazioneAlcolica) : null,
      prezzoExtra: new Decimal(data.prezzoExtra || 0),
      disponibile: data.disponibile ?? true,
      ordinamento: data.ordinamento || 0,
      prodottoRiferimentoId: data.prodottoRiferimentoId,
      immagine: data.immagine
    };

    if (data.id) {
      bottiglia = await db.bottiglia.update({
        where: { id: data.id },
        data: {
          ...bottigliaData,
          updatedAt: new Date()
        }
      });
    } else {
      bottiglia = await db.bottiglia.create({
        data: bottigliaData
      });
    }

    revalidatePath('/dashboard/miscelati/bottiglie');
    return { success: true, data: bottiglia };
  } catch (error) {
    console.error('Errore salvataggio bottiglia:', error);
    return { success: false, error: 'Errore nel salvataggio' };
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

    return { success: true, data: ricette };
  } catch (error) {
    console.error('Errore recupero ricette:', error);
    return { success: false, error: 'Errore nel recupero delle ricette' };
  }
}

export async function saveRicettaMiscelata(data: RicettaMiscelataData) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    const result = await db.$transaction(async (tx) => {
      // Crea o aggiorna il prodotto base
      let prodotto;
      if (data.prodottoId) {
        prodotto = await tx.prodotto.update({
          where: { id: data.prodottoId },
          data: {
            nome: data.nome,
            descrizione: data.descrizione,
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
            prezzo: new Decimal(8), // Prezzo base, sarà calcolato in base agli ingredienti
            categoria: 'COCKTAIL',
            postazione: 'BANCO',
            disponibile: true,
            isMiscelato: true
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
            ghiaccio: data.ghiaccio ?? true
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

    let prezzoTotale = ricetta.prodotto.prezzo;

    // Aggiungi il prezzo extra per ogni bottiglia selezionata
    for (const selezione of selezioniBottiglie) {
      const bottiglia = await db.bottiglia.findUnique({
        where: { id: selezione.bottigliaId }
      });

      if (bottiglia) {
        prezzoTotale = prezzoTotale.add(bottiglia.prezzoExtra);
      }
    }

    return prezzoTotale;
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
            prezzoExtra: new Decimal(0),
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Hendricks',
            marca: 'Hendricks',
            gradazioneAlcolica: new Decimal(44),
            prezzoExtra: new Decimal(2),
            ordinamento: 2
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Tanqueray',
            marca: 'Tanqueray',
            gradazioneAlcolica: new Decimal(43.1),
            prezzoExtra: new Decimal(1),
            ordinamento: 3
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGin.id,
            nome: 'Gin Mare',
            marca: 'Gin Mare',
            gradazioneAlcolica: new Decimal(42.7),
            prezzoExtra: new Decimal(3),
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
            prezzoExtra: new Decimal(2.5),
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catVodka.id,
            nome: 'Belvedere',
            marca: 'Belvedere',
            gradazioneAlcolica: new Decimal(40),
            prezzoExtra: new Decimal(3),
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
            prezzoExtra: new Decimal(0),
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: 'Fever-Tree',
            marca: 'Fever-Tree',
            prezzoExtra: new Decimal(1.5),
            ordinamento: 2
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: '1724',
            marca: '1724',
            prezzoExtra: new Decimal(3),
            ordinamento: 3
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catToniche.id,
            nome: 'Thomas Henry',
            marca: 'Thomas Henry',
            prezzoExtra: new Decimal(1),
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
            prezzoExtra: new Decimal(0),
            ordinamento: 1
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Cetriolo',
            prezzoExtra: new Decimal(0.5),
            ordinamento: 2
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Rosmarino',
            prezzoExtra: new Decimal(0.5),
            ordinamento: 3
          }
        }),
        tx.bottiglia.create({
          data: {
            categoriaId: catGarnish.id,
            nome: 'Bacche di Ginepro',
            prezzoExtra: new Decimal(1),
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