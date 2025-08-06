'use server';

import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-multi-tenant';
import { Decimal } from '@prisma/client/runtime/library';
import { revalidatePath } from 'next/cache';

// Struttura del template Excel
export interface ProductExcelRow {
  // Info Base
  nome: string;
  categoria: string;
  sottocategoria?: string;
  descrizione?: string;
  prezzo: number;
  prezzoPromo?: number;
  
  // Gestione
  disponibile: 'SI' | 'NO';
  postazione: 'BANCO' | 'CUCINA' | 'PIZZA' | 'PANINI';
  ordinamento?: number;
  codice?: string; // SKU/Codice prodotto
  
  // Quantità e Bicchieri
  quantita?: number;
  unitaMisura?: string;
  richiedereBicchieri: 'SI' | 'NO';
  
  // Allergeni e Info Nutrizionali
  allergeni?: string; // Lista separata da virgole
  calorie?: number;
  grassi?: number;
  carboidrati?: number;
  proteine?: number;
  
  // Tempo e Disponibilità
  tempoPreparazione?: number; // in minuti
  orariDisponibilita?: string; // es. "11:00-15:00,19:00-23:00"
  giorniDisponibilita?: string; // es. "LUN,MAR,MER,GIO,VEN"
  limiteGiornaliero?: number;
  
  // Inventario
  minimoScorta?: number;
  fornitore?: string;
  costoAcquisto?: number;
  
  // Tasse
  aliquotaIVA?: number; // percentuale IVA
  
  // Media
  immagineURL?: string;
  
  // Note
  notePreparazione?: string;
  noteInterno?: string;
  
  // Prodotto Miscelato
  eMiscelato: 'SI' | 'NO';
  tipoMiscelato?: 'COCKTAIL' | 'LONGDRINK' | 'SHOTS' | 'MOCKTAILS' | 'VINI' | 'ALTRO';
  
  // Gruppi Ingredienti (fino a 5 gruppi)
  gruppo1Nome?: string;
  gruppo1Obbligatorio?: 'SI' | 'NO';
  gruppo1Min?: number;
  gruppo1Max?: number;
  gruppo1Ingredienti?: string; // Lista separata da virgole
  gruppo1Prezzi?: string; // Lista prezzi separata da virgole
  
  gruppo2Nome?: string;
  gruppo2Obbligatorio?: 'SI' | 'NO';
  gruppo2Min?: number;
  gruppo2Max?: number;
  gruppo2Ingredienti?: string;
  gruppo2Prezzi?: string;
  
  gruppo3Nome?: string;
  gruppo3Obbligatorio?: 'SI' | 'NO';
  gruppo3Min?: number;
  gruppo3Max?: number;
  gruppo3Ingredienti?: string;
  gruppo3Prezzi?: string;
  
  gruppo4Nome?: string;
  gruppo4Obbligatorio?: 'SI' | 'NO';
  gruppo4Min?: number;
  gruppo4Max?: number;
  gruppo4Ingredienti?: string;
  gruppo4Prezzi?: string;
  
  gruppo5Nome?: string;
  gruppo5Obbligatorio?: 'SI' | 'NO';
  gruppo5Min?: number;
  gruppo5Max?: number;
  gruppo5Ingredienti?: string;
  gruppo5Prezzi?: string;
}

// Genera template Excel vuoto
export async function generateExcelTemplate() {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    // Headers con descrizioni
    const headers = [
      // Info Base
      { field: 'nome', label: 'Nome Prodotto*', example: 'Gin Tonic Premium' },
      { field: 'categoria', label: 'Categoria*', example: 'COCKTAIL' },
      { field: 'sottocategoria', label: 'Sottocategoria', example: 'Premium' },
      { field: 'descrizione', label: 'Descrizione', example: 'Gin tonic con selezione premium' },
      { field: 'prezzo', label: 'Prezzo*', example: '8.50' },
      { field: 'prezzoPromo', label: 'Prezzo Promo', example: '7.00' },
      
      // Gestione
      { field: 'disponibile', label: 'Disponibile*', example: 'SI' },
      { field: 'postazione', label: 'Postazione*', example: 'BANCO' },
      { field: 'ordinamento', label: 'Ordine Menu', example: '10' },
      { field: 'codice', label: 'Codice/SKU', example: 'PRD001' },
      
      // Quantità
      { field: 'quantita', label: 'Quantità', example: '330' },
      { field: 'unitaMisura', label: 'Unità Misura', example: 'ML' },
      { field: 'richiedereBicchieri', label: 'Richiede Bicchieri*', example: 'SI' },
      
      // Allergeni
      { field: 'allergeni', label: 'Allergeni', example: 'Glutine,Lattosio' },
      { field: 'calorie', label: 'Calorie (kcal)', example: '250' },
      { field: 'grassi', label: 'Grassi (g)', example: '12' },
      { field: 'carboidrati', label: 'Carboidrati (g)', example: '30' },
      { field: 'proteine', label: 'Proteine (g)', example: '8' },
      
      // Tempo e Disponibilità
      { field: 'tempoPreparazione', label: 'Tempo Prep. (min)', example: '5' },
      { field: 'orariDisponibilita', label: 'Orari Disponibili', example: '11:00-15:00,19:00-23:00' },
      { field: 'giorniDisponibilita', label: 'Giorni Disponibili', example: 'LUN,MAR,MER,GIO,VEN,SAB,DOM' },
      { field: 'limiteGiornaliero', label: 'Limite Giornaliero', example: '50' },
      
      // Inventario
      { field: 'minimoScorta', label: 'Minimo Scorta', example: '10' },
      { field: 'fornitore', label: 'Fornitore', example: 'Fornitore SRL' },
      { field: 'costoAcquisto', label: 'Costo Acquisto', example: '3.50' },
      
      // Tasse
      { field: 'aliquotaIVA', label: 'Aliquota IVA %', example: '22' },
      
      // Media
      { field: 'immagineURL', label: 'URL Immagine', example: 'https://esempio.com/img.jpg' },
      
      // Note
      { field: 'notePreparazione', label: 'Note Preparazione', example: 'Servire con ghiaccio' },
      { field: 'noteInterno', label: 'Note Interne', example: 'Solo per eventi' },
      
      // Prodotto Miscelato
      { field: 'eMiscelato', label: 'È Miscelato*', example: 'NO' },
      { field: 'tipoMiscelato', label: 'Tipo Miscelato', example: 'COCKTAIL' },
      
      // Gruppo 1
      { field: 'gruppo1Nome', label: 'Gruppo 1 - Nome', example: 'Scelta Gin' },
      { field: 'gruppo1Obbligatorio', label: 'Gruppo 1 - Obbligatorio', example: 'SI' },
      { field: 'gruppo1Min', label: 'Gruppo 1 - Min Selezioni', example: '1' },
      { field: 'gruppo1Max', label: 'Gruppo 1 - Max Selezioni', example: '1' },
      { field: 'gruppo1Ingredienti', label: 'Gruppo 1 - Ingredienti', example: 'Bombay,Hendricks,Tanqueray' },
      { field: 'gruppo1Prezzi', label: 'Gruppo 1 - Prezzi Extra', example: '0,2.00,1.00' },
      
      // Gruppo 2
      { field: 'gruppo2Nome', label: 'Gruppo 2 - Nome', example: 'Scelta Tonica' },
      { field: 'gruppo2Obbligatorio', label: 'Gruppo 2 - Obbligatorio', example: 'SI' },
      { field: 'gruppo2Min', label: 'Gruppo 2 - Min Selezioni', example: '1' },
      { field: 'gruppo2Max', label: 'Gruppo 2 - Max Selezioni', example: '1' },
      { field: 'gruppo2Ingredienti', label: 'Gruppo 2 - Ingredienti', example: 'Schweppes,Fever-Tree,1724' },
      { field: 'gruppo2Prezzi', label: 'Gruppo 2 - Prezzi Extra', example: '0,1.50,3.00' },
      
      // Gruppo 3
      { field: 'gruppo3Nome', label: 'Gruppo 3 - Nome', example: 'Garnish Extra' },
      { field: 'gruppo3Obbligatorio', label: 'Gruppo 3 - Obbligatorio', example: 'NO' },
      { field: 'gruppo3Min', label: 'Gruppo 3 - Min Selezioni', example: '0' },
      { field: 'gruppo3Max', label: 'Gruppo 3 - Max Selezioni', example: '2' },
      { field: 'gruppo3Ingredienti', label: 'Gruppo 3 - Ingredienti', example: 'Lime,Cetriolo,Rosmarino' },
      { field: 'gruppo3Prezzi', label: 'Gruppo 3 - Prezzi Extra', example: '0,0.50,0.50' },
      
      // Gruppo 4
      { field: 'gruppo4Nome', label: 'Gruppo 4 - Nome', example: '' },
      { field: 'gruppo4Obbligatorio', label: 'Gruppo 4 - Obbligatorio', example: '' },
      { field: 'gruppo4Min', label: 'Gruppo 4 - Min Selezioni', example: '' },
      { field: 'gruppo4Max', label: 'Gruppo 4 - Max Selezioni', example: '' },
      { field: 'gruppo4Ingredienti', label: 'Gruppo 4 - Ingredienti', example: '' },
      { field: 'gruppo4Prezzi', label: 'Gruppo 4 - Prezzi Extra', example: '' },
      
      // Gruppo 5
      { field: 'gruppo5Nome', label: 'Gruppo 5 - Nome', example: '' },
      { field: 'gruppo5Obbligatorio', label: 'Gruppo 5 - Obbligatorio', example: '' },
      { field: 'gruppo5Min', label: 'Gruppo 5 - Min Selezioni', example: '' },
      { field: 'gruppo5Max', label: 'Gruppo 5 - Max Selezioni', example: '' },
      { field: 'gruppo5Ingredienti', label: 'Gruppo 5 - Ingredienti', example: '' },
      { field: 'gruppo5Prezzi', label: 'Gruppo 5 - Prezzi Extra', example: '' },
    ];

    // Crea workbook
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Template
    const templateData = [
      headers.map(h => h.label),
      headers.map(h => h.example)
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Imposta larghezza colonne
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.label.length, 20) }));
    
    XLSX.utils.book_append_sheet(wb, ws, 'Prodotti');
    
    // Sheet 2: Istruzioni
    const instructions = [
      ['ISTRUZIONI PER LA COMPILAZIONE'],
      [''],
      ['CAMPI OBBLIGATORI (contrassegnati con *)'],
      ['- nome: Nome del prodotto'],
      ['- categoria: COCKTAIL, BEVANDE, CIBO, DOLCI, CAFFE, VINI, BIRRE, etc.'],
      ['- prezzo: Prezzo in euro (usare punto per decimali)'],
      ['- disponibile: SI o NO'],
      ['- postazione: BANCO, CUCINA, PIZZA, PANINI'],
      ['- richiedereBicchieri: SI o NO'],
      ['- eMiscelato: SI o NO (indica se il prodotto ha varianti configurabili)'],
      [''],
      ['PRODOTTI MISCELATI'],
      ['Se eMiscelato = SI, compilare:'],
      ['- tipoMiscelato: COCKTAIL, LONGDRINK, SHOTS, MOCKTAILS, VINI, ALTRO'],
      ['- Gruppi ingredienti (fino a 5 gruppi)'],
      ['- Per ogni gruppo specificare: nome, obbligatorietà, min/max selezioni'],
      ['- Ingredienti: lista separata da virgole'],
      ['- Prezzi: lista prezzi extra separata da virgole (stesso ordine degli ingredienti)'],
      [''],
      ['ORARI E GIORNI'],
      ['- orariDisponibilita: formato "HH:MM-HH:MM,HH:MM-HH:MM"'],
      ['- giorniDisponibilita: LUN,MAR,MER,GIO,VEN,SAB,DOM'],
      [''],
      ['ALLERGENI'],
      ['Lista separata da virgole: Glutine,Lattosio,Uova,Frutta a guscio,etc.'],
      [''],
      ['NOTE'],
      ['- La prima riga contiene i nomi delle colonne'],
      ['- La seconda riga contiene esempi di compilazione'],
      ['- Eliminare la riga degli esempi prima dell\'importazione'],
      ['- Salvare il file in formato Excel (.xlsx)']
    ];
    
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Istruzioni');
    
    // Sheet 3: Valori Consentiti
    const allowedValues = [
      ['VALORI CONSENTITI PER I CAMPI'],
      [''],
      ['CATEGORIE'],
      ['COCKTAIL, BEVANDE, CIBO, DOLCI, CAFFE, VINI, BIRRE, SUPERALCOLICI, AMARI, LIQUORI, APERITIVI, DIGESTIVI'],
      [''],
      ['POSTAZIONI'],
      ['BANCO, CUCINA, PIZZA, PANINI'],
      [''],
      ['UNITÀ DI MISURA'],
      ['ML (millilitri), CL (centilitri), L (litri), G (grammi), KG (kilogrammi), PZ (pezzi)'],
      [''],
      ['TIPI MISCELATO'],
      ['COCKTAIL, LONGDRINK, SHOTS, MOCKTAILS, VINI, ALTRO'],
      [''],
      ['GIORNI SETTIMANA'],
      ['LUN, MAR, MER, GIO, VEN, SAB, DOM'],
      [''],
      ['ALLERGENI COMUNI'],
      ['Glutine, Crostacei, Uova, Pesce, Arachidi, Soia, Latte, Frutta a guscio,'],
      ['Sedano, Senape, Semi di sesamo, Anidride solforosa, Lupini, Molluschi']
    ];
    
    const wsValues = XLSX.utils.aoa_to_sheet(allowedValues);
    XLSX.utils.book_append_sheet(wb, wsValues, 'Valori Consentiti');
    
    // Genera buffer e converti in base64
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const base64 = Buffer.from(buffer).toString('base64');
    
    return { 
      success: true, 
      data: base64,
      filename: `template_prodotti_${new Date().toISOString().split('T')[0]}.xlsx`
    };
  } catch (error) {
    console.error('Errore generazione template:', error);
    return { success: false, error: 'Errore nella generazione del template' };
  }
}

// Importa prodotti da file Excel
export async function importProductsFromExcel(fileBuffer: Buffer) {
  try {
    const session = await getCurrentUser();
    if (!session || !['ADMIN', 'MANAGER', 'SUPERVISORE'].includes(session.ruolo)) {
      return { success: false, error: 'Non autorizzato' };
    }

    // Leggi il file Excel
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converti in JSON
    const data = XLSX.utils.sheet_to_json<ProductExcelRow>(worksheet);
    
    // Validazione e importazione
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 perché Excel parte da 1 e c'è l'header
      
      try {
        // Validazione campi obbligatori
        if (!row.nome || !row.categoria || row.prezzo === undefined) {
          results.errors.push(`Riga ${rowNum}: Campi obbligatori mancanti`);
          results.failed++;
          continue;
        }

        // Converti valori SI/NO in booleani
        const disponibile = row.disponibile === 'SI';
        const richiedereBicchieri = row.richiedereBicchieri === 'SI';
        const eMiscelato = row.eMiscelato === 'SI';

        // Crea il prodotto base
        const prodotto = await db.prodotto.create({
          data: {
            nome: row.nome,
            categoria: row.categoria,
            descrizione: row.descrizione || '',
            prezzo: new Decimal(row.prezzo),
            disponibile,
            postazione: (['PREPARA', 'CUCINA', 'BANCO', 'IMMEDIATO'].includes(row.postazione)) ? row.postazione as 'PREPARA' | 'CUCINA' | 'BANCO' | 'IMMEDIATO' : 'BANCO',
            // richiedereBicchieri field doesn't exist in schema
            // Campi aggiuntivi potrebbero essere salvati in una tabella metadata
            updatedAt: new Date()
          }
        });

        // Se è un prodotto miscelato, crea la configurazione
        if (eMiscelato && row.tipoMiscelato) {
          const prodottoConfig = await db.prodottoConfigurabile.create({
            data: {
              prodottoId: prodotto.id,
              nome: row.nome,
              tipo: row.tipoMiscelato as any,
              richiedeScelta: true,
              sceltaMultipla: false
            }
          });

          // Crea i gruppi di ingredienti
          for (let g = 1; g <= 5; g++) {
            const gruppoNome = row[`gruppo${g}Nome` as keyof ProductExcelRow];
            if (gruppoNome && typeof gruppoNome === 'string') {
              const ingredienti = row[`gruppo${g}Ingredienti` as keyof ProductExcelRow] as string;
              const prezzi = row[`gruppo${g}Prezzi` as keyof ProductExcelRow] as string;
              const obbligatorio = row[`gruppo${g}Obbligatorio` as keyof ProductExcelRow] === 'SI';
              const min = row[`gruppo${g}Min` as keyof ProductExcelRow] as number || 1;
              const max = row[`gruppo${g}Max` as keyof ProductExcelRow] as number || 1;

              const gruppo = await db.gruppoIngredienti.create({
                data: {
                  prodottoConfigurableId: prodottoConfig.id,
                  nome: gruppoNome,
                  obbligatorio,
                  minimoSelezioni: min,
                  massimoSelezioni: max,
                  ordinamento: g
                }
              });

              // Crea gli ingredienti del gruppo
              if (ingredienti) {
                const ingredientiList = ingredienti.split(',').map(i => i.trim());
                const prezziList = prezzi ? prezzi.split(',').map(p => parseFloat(p.trim())) : [];

                for (let i = 0; i < ingredientiList.length; i++) {
                  await db.ingrediente.create({
                    data: {
                      gruppoIngredientiId: gruppo.id,
                      nome: ingredientiList[i],
                      prezzoExtra: new Decimal(prezziList[i] || 0),
                      disponibile: true,
                      ordinamento: i
                    }
                  });
                }
              }
            }
          }
        }

        // Salva metadata aggiuntivi (potrebbero essere in una tabella separata)
        // Per ora li logghiamo solo
        if (row.allergeni || row.calorie || row.tempoPreparazione) {
          console.log(`Metadata per ${row.nome}:`, {
            allergeni: row.allergeni,
            calorie: row.calorie,
            tempoPreparazione: row.tempoPreparazione,
            // ... altri campi
          });
        }

        results.success++;
      } catch (error) {
        console.error(`Errore importazione riga ${rowNum}:`, error);
        results.errors.push(`Riga ${rowNum}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        results.failed++;
      }
    }

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/miscelati/prodotti');

    return {
      success: true,
      results,
      message: `Importati ${results.success} prodotti su ${data.length}. ${results.failed} falliti.`
    };
  } catch (error) {
    console.error('Errore importazione Excel:', error);
    return { 
      success: false, 
      error: 'Errore durante l\'importazione del file Excel' 
    };
  }
}

// Esporta prodotti in Excel
export async function exportProductsToExcel() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return { success: false, error: 'Non autorizzato' };
    }

    // Recupera tutti i prodotti, gestendo l'assenza delle tabelle configurabili
    let prodotti;
    try {
      // Prova con le tabelle configurabili
      prodotti = await db.prodotto.findMany({
        include: {
          ProdottoConfigurabile: {
            include: {
              GruppiIngredienti: {
                include: {
                  Ingredienti: true
                },
                orderBy: { ordinamento: 'asc' }
              }
            }
          }
        },
        orderBy: { nome: 'asc' }
      });
    } catch (error: any) {
      // Se le tabelle configurabili non esistono, recupera solo i prodotti base
      console.log('Tabelle configurabili non esistono, esportando solo prodotti base');
      prodotti = await db.prodotto.findMany({
        orderBy: { nome: 'asc' }
      });
    }

    // Converti in formato Excel
    const excelData = prodotti.map((prod: any) => {
      const row: any = {
        nome: prod.nome,
        categoria: prod.categoria,
        descrizione: prod.descrizione || '',
        prezzo: prod.prezzo.toNumber(),
        disponibile: prod.disponibile ? 'SI' : 'NO',
        postazione: prod.postazione,
        richiedereBicchieri: (prod as any).richiedereBicchieri ? 'SI' : 'NO',
        eMiscelato: prod.ProdottoConfigurabile ? 'SI' : 'NO'
      };

      // Se è miscelato, aggiungi i gruppi
      if (prod.ProdottoConfigurabile) {
        row.tipoMiscelato = prod.ProdottoConfigurabile.tipo;
        
        prod.ProdottoConfigurabile.GruppiIngredienti?.forEach((gruppo: any, index: number) => {
          const num = index + 1;
          row[`gruppo${num}Nome`] = gruppo.nome;
          row[`gruppo${num}Obbligatorio`] = gruppo.obbligatorio ? 'SI' : 'NO';
          row[`gruppo${num}Min`] = gruppo.minimoSelezioni;
          row[`gruppo${num}Max`] = gruppo.massimoSelezioni;
          row[`gruppo${num}Ingredienti`] = gruppo.Ingredienti?.map((i: any) => i.nome).join(',') || '';
          row[`gruppo${num}Prezzi`] = gruppo.Ingredienti?.map((i: any) => i.prezzoExtra.toNumber()).join(',') || '';
        });
      }

      return row;
    });

    // Se non ci sono prodotti, crea un Excel con solo headers
    if (excelData.length === 0) {
      console.log('Nessun prodotto trovato, generando Excel con solo headers');
      const headers = [
        'nome', 'categoria', 'descrizione', 'prezzo', 'disponibile', 
        'postazione', 'richiedereBicchieri', 'eMiscelato'
      ];
      excelData.push({
        nome: 'Esempio Prodotto',
        categoria: 'BEVANDE',
        descrizione: 'Descrizione esempio',
        prezzo: 0,
        disponibile: 'SI',
        postazione: 'BANCO',
        richiedereBicchieri: 'NO',
        eMiscelato: 'NO'
      });
    }
    
    // Crea workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Prodotti');
    
    // Genera buffer e converti in base64
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const base64 = Buffer.from(buffer).toString('base64');
    
    return { 
      success: true, 
      data: base64,
      filename: `export_prodotti_${new Date().toISOString().split('T')[0]}.xlsx`
    };
  } catch (error) {
    console.error('Errore esportazione Excel:', error);
    return { success: false, error: 'Errore durante l\'esportazione' };
  }
}