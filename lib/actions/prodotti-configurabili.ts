'use server';

import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-multi-tenant';
import { Decimal } from '@prisma/client/runtime/library';

export interface IngredienteConfig {
  id: string;
  nome: string;
  descrizione?: string;
  prezzoExtra: number;
  disponibile: boolean;
  ordinamento: number;
  prodottoRiferimentoId?: number;
}

export interface GruppoIngredientiConfig {
  id: string;
  nome: string;
  descrizione?: string;
  obbligatorio: boolean;
  ordinamento: number;
  minimoSelezioni: number;
  massimoSelezioni: number;
  ingredienti: IngredienteConfig[];
}

export interface ProdottoConfigurabileFull {
  id: string;
  prodottoId: number;
  nome: string;
  tipo: string;
  richiedeScelta: boolean;
  sceltaMultipla: boolean;
  gruppiIngredienti: GruppoIngredientiConfig[];
}

// Ottieni configurazione prodotto
export async function getProdottoConfigurabile(prodottoId: number): Promise<ProdottoConfigurabileFull | null> {
  try {
    // Prima controlla se è un prodotto miscelato
    const prodotto = await db.prodotto.findUnique({
      where: { id: prodottoId },
      select: { isMiscelato: true, nome: true }
    });

    if (prodotto?.isMiscelato) {
      // Per i prodotti miscelati, crea una configurazione virtuale
      // con gli ingredienti disponibili dalla categoria MISCELATI
      const ingredientiMiscelati = await db.prodotto.findMany({
        where: {
          categoria: 'MISCELATI',
          disponibile: true,
          terminato: false,
          isMiscelato: false // Solo gli ingredienti, non altri prodotti miscelati
        },
        orderBy: { nome: 'asc' }
      });

      return {
        id: `miscelato-${prodottoId}`,
        prodottoId: prodottoId,
        nome: prodotto.nome,
        tipo: 'MISCELATO',
        richiedeScelta: true,
        sceltaMultipla: false,
        gruppiIngredienti: [{
          id: 'gruppo-miscelato',
          nome: 'Scegli il gusto',
          descrizione: 'Seleziona il gusto desiderato',
          obbligatorio: true,
          ordinamento: 0,
          minimoSelezioni: 1,
          massimoSelezioni: 1,
          ingredienti: ingredientiMiscelati.map((ing, index) => ({
            id: ing.id.toString(),
            nome: ing.nome,
            descrizione: undefined,
            prezzoExtra: 0, // I miscelati non hanno sovrapprezzo
            disponibile: ing.disponibile && !ing.terminato,
            ordinamento: index,
            prodottoRiferimentoId: ing.id
          }))
        }]
      };
    }

    // Altrimenti cerca configurazione normale
    const prodottoConfig = await db.prodottoConfigurabile.findUnique({
      where: { prodottoId },
      include: {
        GruppiIngredienti: {
          orderBy: { ordinamento: 'asc' },
          include: {
            Ingredienti: {
              where: { disponibile: true },
              orderBy: { ordinamento: 'asc' }
            }
          }
        }
      }
    });

    if (!prodottoConfig) return null;

    return {
      id: prodottoConfig.id,
      prodottoId: prodottoConfig.prodottoId,
      nome: prodottoConfig.nome,
      tipo: prodottoConfig.tipo,
      richiedeScelta: prodottoConfig.richiedeScelta,
      sceltaMultipla: prodottoConfig.sceltaMultipla,
      gruppiIngredienti: prodottoConfig.GruppiIngredienti.map((gruppo: any) => ({
        id: gruppo.id,
        nome: gruppo.nome,
        descrizione: gruppo.descrizione || undefined,
        obbligatorio: gruppo.obbligatorio,
        ordinamento: gruppo.ordinamento,
        minimoSelezioni: gruppo.minimoSelezioni,
        massimoSelezioni: gruppo.massimoSelezioni,
        ingredienti: gruppo.Ingredienti.map((ing: any) => ({
          id: ing.id,
          nome: ing.nome,
          descrizione: ing.descrizione || undefined,
          prezzoExtra: ing.prezzoExtra.toNumber(),
          disponibile: ing.disponibile,
          ordinamento: ing.ordinamento,
          prodottoRiferimentoId: ing.prodottoRiferimentoId || undefined
        }))
      }))
    };
  } catch (error) {
    console.error('Errore nel recupero prodotto configurabile:', error);
    return null;
  }
}

// Crea o aggiorna prodotto configurabile
export async function upsertProdottoConfigurabile(
  prodottoId: number,
  data: {
    nome: string;
    tipo?: string;
    richiedeScelta?: boolean;
    sceltaMultipla?: boolean;
  }
) {
  const session = await getCurrentUser();
  if (!session || session.ruolo !== 'SUPERVISORE') {
    throw new Error('Non autorizzato');
  }

  try {
    const prodottoConfig = await db.prodottoConfigurabile.upsert({
      where: { prodottoId },
      update: {
        nome: data.nome,
        tipo: data.tipo as any || 'COCKTAIL',
        richiedeScelta: data.richiedeScelta ?? true,
        sceltaMultipla: data.sceltaMultipla ?? false,
        updatedAt: new Date()
      },
      create: {
        prodottoId,
        nome: data.nome,
        tipo: data.tipo as any || 'COCKTAIL',
        richiedeScelta: data.richiedeScelta ?? true,
        sceltaMultipla: data.sceltaMultipla ?? false
      }
    });

    return { success: true, data: prodottoConfig };
  } catch (error) {
    console.error('Errore upsert prodotto configurabile:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

// Aggiungi gruppo ingredienti
export async function addGruppoIngredienti(
  prodottoConfigurableId: string,
  data: {
    nome: string;
    descrizione?: string;
    obbligatorio?: boolean;
    ordinamento?: number;
    minimoSelezioni?: number;
    massimoSelezioni?: number;
  }
) {
  const session = await getCurrentUser();
  if (!session || session.ruolo !== 'SUPERVISORE') {
    throw new Error('Non autorizzato');
  }

  try {
    const gruppo = await db.gruppoIngredienti.create({
      data: {
        prodottoConfigurableId,
        nome: data.nome,
        descrizione: data.descrizione,
        obbligatorio: data.obbligatorio ?? true,
        ordinamento: data.ordinamento ?? 0,
        minimoSelezioni: data.minimoSelezioni ?? 1,
        massimoSelezioni: data.massimoSelezioni ?? 1
      }
    });

    return { success: true, data: gruppo };
  } catch (error) {
    console.error('Errore aggiunta gruppo ingredienti:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

// Aggiungi ingrediente a un gruppo
export async function addIngrediente(
  gruppoIngredientiId: string,
  data: {
    nome: string;
    descrizione?: string;
    prezzoExtra?: number;
    disponibile?: boolean;
    ordinamento?: number;
    prodottoRiferimentoId?: number;
  }
) {
  const session = await getCurrentUser();
  if (!session || session.ruolo !== 'SUPERVISORE') {
    throw new Error('Non autorizzato');
  }

  try {
    const ingrediente = await db.ingrediente.create({
      data: {
        gruppoIngredientiId,
        nome: data.nome,
        descrizione: data.descrizione,
        prezzoExtra: new Decimal(data.prezzoExtra || 0),
        disponibile: data.disponibile ?? true,
        ordinamento: data.ordinamento ?? 0,
        prodottoRiferimentoId: data.prodottoRiferimentoId
      }
    });

    return { success: true, data: ingrediente };
  } catch (error) {
    console.error('Errore aggiunta ingrediente:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

// Aggiorna ingrediente
export async function updateIngrediente(
  ingredienteId: string,
  data: {
    nome?: string;
    descrizione?: string;
    prezzoExtra?: number;
    disponibile?: boolean;
    ordinamento?: number;
  }
) {
  const session = await getCurrentUser();
  if (!session || session.ruolo !== 'SUPERVISORE') {
    throw new Error('Non autorizzato');
  }

  try {
    const ingrediente = await db.ingrediente.update({
      where: { id: ingredienteId },
      data: {
        ...(data.nome && { nome: data.nome }),
        ...(data.descrizione !== undefined && { descrizione: data.descrizione }),
        ...(data.prezzoExtra !== undefined && { prezzoExtra: new Decimal(data.prezzoExtra) }),
        ...(data.disponibile !== undefined && { disponibile: data.disponibile }),
        ...(data.ordinamento !== undefined && { ordinamento: data.ordinamento }),
        updatedAt: new Date()
      }
    });

    return { success: true, data: ingrediente };
  } catch (error) {
    console.error('Errore aggiornamento ingrediente:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

// Elimina ingrediente
export async function deleteIngrediente(ingredienteId: string) {
  const session = await getCurrentUser();
  if (!session || session.ruolo !== 'SUPERVISORE') {
    throw new Error('Non autorizzato');
  }

  try {
    await db.ingrediente.delete({
      where: { id: ingredienteId }
    });

    return { success: true };
  } catch (error) {
    console.error('Errore eliminazione ingrediente:', error);
    return { success: false, error: 'Errore nell\'eliminazione' };
  }
}

// Elimina gruppo ingredienti
export async function deleteGruppoIngredienti(gruppoId: string) {
  const session = await getCurrentUser();
  if (!session || session.ruolo !== 'SUPERVISORE') {
    throw new Error('Non autorizzato');
  }

  try {
    await db.gruppoIngredienti.delete({
      where: { id: gruppoId }
    });

    return { success: true };
  } catch (error) {
    console.error('Errore eliminazione gruppo:', error);
    return { success: false, error: 'Errore nell\'eliminazione' };
  }
}

// Calcola prezzo totale con configurazione
export async function calcolaPrezzoConfigurazione(
  prezzoBase: number,
  configurazione: Array<{ ingredienteId: string; prezzoExtra: number }>
): Promise<number> {
  const totaleExtra = configurazione.reduce((sum, item) => sum + item.prezzoExtra, 0);
  return prezzoBase + totaleExtra;
}

// Salva configurazione per una riga ordine
export async function saveConfigurazioneRigaOrdine(
  rigaOrdinazioneId: string,
  configurazione: any,
  prezzoFinale: number
) {
  try {
    const config = await db.configurazioneRigaOrdine.create({
      data: {
        rigaOrdinazioneId,
        configurazione,
        prezzoFinale: new Decimal(prezzoFinale)
      }
    });

    return { success: true, data: config };
  } catch (error) {
    console.error('Errore salvataggio configurazione:', error);
    return { success: false, error: 'Errore nel salvataggio' };
  }
}

// Ottieni tutti i prodotti configurabili
export async function getAllProdottiConfigurabili() {
  try {
    const prodotti = await db.prodottoConfigurabile.findMany({
      include: {
        Prodotto: true,
        GruppiIngredienti: {
          include: {
            Ingredienti: true
          }
        }
      },
      orderBy: { nome: 'asc' }
    });

    return prodotti;
  } catch (error) {
    console.error('Errore recupero prodotti configurabili:', error);
    return [];
  }
}