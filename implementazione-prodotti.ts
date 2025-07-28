// Implementazione sistema gestione prodotti unificato

// Tipi base
interface Prodotto {
  id: string
  codice: string
  nome: string
  categoria: string
  sottocategoria?: string
  
  // Magazzino
  fornitore: string
  codiceFornitore?: string
  unitaMisura: string
  quantitaPerConfezione: number
  prezzoAcquisto: number
  iva: number
  imponibile: number
  volumeMagazzino?: string
  peso?: number
  
  // Menu
  descrizioneMenu?: string
  ingredienti?: string[]
  allergeni?: string[]
  prezzoVendita: number
  volumeServizio?: string
  tempoPreparazione?: number
  disponibileMenu: boolean
  
  // Inventario
  giacenzaMinima: number
  giacenzaAttuale: number
  puntoRiordino: number
  
  // Conversioni
  conversioni?: {
    daUnitaMagazzino: string
    aUnitaServizio: string
    fattoreConversione: number
  }
  
  // Metadata
  dataCreazione: Date
  dataUltimaModifica: Date
  attivo: boolean
}

// Classe per gestire i prodotti
class GestioneProdotti {
  private prodotti: Map<string, Prodotto> = new Map()
  
  // Aggiunge o aggiorna un prodotto
  async salvaProdotto(prodotto: Prodotto): Promise<void> {
    prodotto.dataUltimaModifica = new Date()
    if (!prodotto.dataCreazione) {
      prodotto.dataCreazione = new Date()
    }
    
    // Calcola automaticamente l'imponibile se non specificato
    if (!prodotto.imponibile && prodotto.prezzoAcquisto && prodotto.iva) {
      prodotto.imponibile = prodotto.prezzoAcquisto / (1 + prodotto.iva / 100)
    }
    
    this.prodotti.set(prodotto.id, prodotto)
  }
  
  // Vista Magazzino con calcoli specifici
  getVistamagazzino() {
    return Array.from(this.prodotti.values())
      .filter(p => p.attivo)
      .map(p => ({
        id: p.id,
        codice: p.codice,
        nome: p.nome,
        fornitore: p.fornitore,
        codiceFornitore: p.codiceFornitore,
        unitaMisura: p.unitaMisura,
        quantitaPerConfezione: p.quantitaPerConfezione,
        prezzoAcquisto: p.prezzoAcquisto,
        iva: p.iva,
        imponibile: p.imponibile,
        prezzoConIva: p.prezzoAcquisto,
        volumeMagazzino: p.volumeMagazzino,
        giacenzaAttuale: p.giacenzaAttuale,
        giacenzaMinima: p.giacenzaMinima,
        puntoRiordino: p.puntoRiordino,
        valoreGiacenza: p.giacenzaAttuale * p.prezzoAcquisto,
        daRiordinare: p.giacenzaAttuale <= p.puntoRiordino
      }))
  }
  
  // Vista Menu con disponibilità
  getVistaMenu() {
    return Array.from(this.prodotti.values())
      .filter(p => p.attivo && p.disponibileMenu)
      .map(p => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        descrizione: p.descrizioneMenu || p.nome,
        ingredienti: p.ingredienti || [],
        allergeni: p.allergeni || [],
        prezzoVendita: p.prezzoVendita,
        volumeServizio: p.volumeServizio,
        tempoPreparazione: p.tempoPreparazione,
        disponibile: this.calcolaDisponibilitaMenu(p),
        margine: this.calcolaMargine(p)
      }))
  }
  
  // Calcola disponibilità per il menu considerando le conversioni
  private calcolaDisponibilitaMenu(prodotto: Prodotto): number {
    if (!prodotto.conversioni) {
      return prodotto.giacenzaAttuale
    }
    
    // Converte la giacenza del magazzino in porzioni servibili
    return Math.floor(
      prodotto.giacenzaAttuale * prodotto.conversioni.fattoreConversione
    )
  }
  
  // Calcola il margine di profitto
  private calcolaMargine(prodotto: Prodotto): {
    valore: number
    percentuale: number
  } {
    let costoUnitario = prodotto.prezzoAcquisto
    
    // Se c'è conversione, calcola il costo per porzione
    if (prodotto.conversioni) {
      costoUnitario = prodotto.prezzoAcquisto / prodotto.conversioni.fattoreConversione
    }
    
    const margine = prodotto.prezzoVendita - costoUnitario
    const percentuale = (margine / prodotto.prezzoVendita) * 100
    
    return {
      valore: margine,
      percentuale: Math.round(percentuale * 100) / 100
    }
  }
  
  // Report per riordini
  getProdottiDaRiordinare() {
    return this.getVistamagazzino()
      .filter(p => p.daRiordinare)
      .sort((a, b) => a.giacenzaAttuale - b.giacenzaAttuale)
  }
  
  // Aggiorna giacenza dopo vendita
  async registraVendita(prodottoId: string, quantita: number): Promise<void> {
    const prodotto = this.prodotti.get(prodottoId)
    if (!prodotto) throw new Error('Prodotto non trovato')
    
    // Se il prodotto ha conversioni, converti la quantità venduta
    let quantitaMagazzino = quantita
    if (prodotto.conversioni) {
      quantitaMagazzino = quantita / prodotto.conversioni.fattoreConversione
    }
    
    prodotto.giacenzaAttuale -= quantitaMagazzino
    prodotto.dataUltimaModifica = new Date()
    
    // Controlla se serve riordinare
    if (prodotto.giacenzaAttuale <= prodotto.puntoRiordino) {
      console.log(`ATTENZIONE: Riordinare ${prodotto.nome}`)
    }
  }
}

// Esempio di utilizzo
const gestione = new GestioneProdotti()

// Esempio: Coca Cola
const cocaCola: Prodotto = {
  id: '1',
  codice: 'BEV001',
  nome: 'Coca Cola',
  categoria: 'Bevande',
  sottocategoria: 'Bibite',
  
  // Dati magazzino
  fornitore: 'Coca Cola HBC',
  codiceFornitore: 'CC330',
  unitaMisura: 'cartone',
  quantitaPerConfezione: 24,
  prezzoAcquisto: 12.00,
  iva: 10,
  imponibile: 10.91,
  volumeMagazzino: '24x33cl',
  
  // Dati menu
  descrizioneMenu: 'Coca Cola classica',
  prezzoVendita: 3.50,
  volumeServizio: '33cl',
  disponibileMenu: true,
  
  // Inventario
  giacenzaAttuale: 10, // 10 cartoni = 240 lattine
  giacenzaMinima: 5,
  puntoRiordino: 8,
  
  // Conversione: 1 cartone = 24 lattine
  conversioni: {
    daUnitaMagazzino: 'cartone',
    aUnitaServizio: 'lattina',
    fattoreConversione: 24
  },
  
  dataCreazione: new Date(),
  dataUltimaModifica: new Date(),
  attivo: true
}

gestione.salvaProdotto(cocaCola)