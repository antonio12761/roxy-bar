"use client";

import { NetumPrinter, ReceiptData, netumPrinter } from './netum-printer';

/**
 * Servizio per gestione stampa automatica scontrini
 * Integrato con il sistema di pagamenti della cassa
 */

export interface PrinterStatus {
  connected: boolean;
  deviceName?: string;
  lastPrint?: Date;
  error?: string;
}

export class PrinterService {
  private printer: NetumPrinter;
  private status: PrinterStatus = { connected: false };
  private listeners: Array<(status: PrinterStatus) => void> = [];
  private debugListeners: Array<(log: string) => void> = [];
  
  /**
   * Log debug message
   */
  private logDebug(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.debugListeners.forEach(callback => callback(logMessage));
  }
  
  /**
   * Subscribe to debug logs
   */
  onDebugLog(callback: (log: string) => void): () => void {
    this.debugListeners.push(callback);
    return () => {
      const index = this.debugListeners.indexOf(callback);
      if (index > -1) {
        this.debugListeners.splice(index, 1);
      }
    };
  }

  constructor() {
    this.printer = netumPrinter;
    // Collega il logging del printer al nostro sistema
    this.printer.onLog = (message: string) => {
      this.logDebug(message);
    };
  }

  /**
   * Sottoscrivi agli aggiornamenti di stato stampante
   */
  onStatusChange(callback: (status: PrinterStatus) => void): () => void {
    this.listeners.push(callback);
    // Ritorna funzione per rimuovere listener
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notifica cambiamenti di stato ai listeners
   */
  private notifyStatusChange(): void {
    this.listeners.forEach(callback => callback({ ...this.status }));
  }

  /**
   * Aggiorna stato stampante
   */
  private updateStatus(updates: Partial<PrinterStatus>): void {
    this.status = { ...this.status, ...updates };
    this.notifyStatusChange();
  }

  /**
   * Connetti alla stampante con logging dettagliato
   */
  async connectPrinter(): Promise<boolean> {
    try {
      this.logDebug('Inizio connessione stampante...');
      this.updateStatus({ error: undefined });
      
      const connected = await this.printer.connect();
      
      if (connected) {
        const deviceInfo = this.printer.getDeviceInfo();
        this.updateStatus({
          connected: true,
          deviceName: deviceInfo.name,
          error: undefined
        });
        
        this.logDebug(`✅ Stampante connessa: ${deviceInfo.name}`);
        return true;
      } else {
        this.updateStatus({
          connected: false,
          error: 'Connessione fallita'
        });
        this.logDebug('❌ Connessione fallita');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      this.updateStatus({
        connected: false,
        error: errorMessage
      });
      this.logDebug(`❌ Errore connessione: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.logDebug(`Stack: ${error.stack}`);
      }
      return false;
    }
  }

  /**
   * Disconnetti stampante
   */
  async disconnectPrinter(): Promise<void> {
    try {
      await this.printer.disconnect();
      this.updateStatus({
        connected: false,
        deviceName: undefined,
        error: undefined
      });
      console.log('📴 Stampante disconnessa');
    } catch (error) {
      console.error('Errore disconnessione:', error);
    }
  }

  /**
   * Verifica stato connessione
   */
  isConnected(): boolean {
    const connected = this.printer.getConnectionStatus();
    
    // Aggiorna stato se non sincronizzato
    if (this.status.connected !== connected) {
      this.updateStatus({ connected });
    }
    
    return connected;
  }

  /**
   * Ottieni stato corrente
   */
  getStatus(): PrinterStatus {
    // Aggiorna connessione prima di ritornare stato
    this.isConnected();
    return { ...this.status };
  }

  /**
   * Stampa test di connessione
   */
  async printTest(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        throw new Error('Stampante non connessa');
      }

      const success = await this.printer.printTest();
      
      if (success) {
        this.updateStatus({ 
          lastPrint: new Date(),
          error: undefined 
        });
      } else {
        this.updateStatus({ 
          error: 'Test di stampa fallito' 
        });
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore test';
      this.updateStatus({ error: errorMessage });
      console.error('❌ Errore test stampa:', error);
      return false;
    }
  }

  /**
   * Carica impostazioni scontrino dal database
   */
  async loadReceiptSettings(): Promise<any> {
    try {
      this.logDebug('Chiamata API impostazioni-scontrino...');
      console.log('🌐 Chiamata API /api/impostazioni-scontrino');
      
      const response = await fetch('/api/impostazioni-scontrino', {
        method: 'GET',
        credentials: 'include', // IMPORTANTE: include cookies per autenticazione
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('📡 Risposta status:', response.status);
      
      if (!response.ok) {
        this.logDebug(`API risposta non OK: ${response.status} ${response.statusText}`);
        console.error('❌ API ERROR:', response.status, response.statusText);
        
        // Prova a leggere il corpo dell'errore
        try {
          const errorBody = await response.text();
          console.error('❌ Error body:', errorBody);
        } catch (e) {}
        
        return null;
      }
      
      const result = await response.json();
      this.logDebug('Risposta API: ' + JSON.stringify(result));
      
      if (result.success && result.data) {
        this.logDebug('Impostazioni caricate con successo');
        this.logDebug('Nome attività: ' + result.data.nomeAttivita);
        this.logDebug('Indirizzo: ' + result.data.indirizzo);
        return result.data;
      } else {
        this.logDebug('Nessuna impostazione trovata nella risposta');
      }
    } catch (error) {
      this.logDebug('ERRORE caricamento impostazioni: ' + error);
      console.error('Errore dettagliato:', error);
    }
    return null;
  }

  /**
   * Formatta dati scontrino con impostazioni personalizzate
   */
  formatReceiptWithSettings(data: ReceiptData, settings: any): ReceiptData {
    if (!settings) {
      console.error('❌ NESSUNA IMPOSTAZIONE SCONTRINO TROVATA!');
      throw new Error('Configurare le impostazioni scontrino in admin prima di stampare');
    }
    
    const formattedData: any = { ...data };
    
    // USA SOLO IMPOSTAZIONI DA ADMIN - NESSUN DEFAULT
    formattedData.header = {
      businessName: settings.nomeAttivita, // RICHIESTO
      address: settings.indirizzo,
      phone: settings.telefono,
      vatNumber: settings.partitaIva,
      fiscalCode: settings.codiceFiscale
    };
    
    // Logo rimosso - stampanti termiche Bluetooth non supportano immagini
    
    // Messaggi personalizzati
    if (settings.messaggioIntestazione) {
      formattedData.headerMessage = settings.messaggioIntestazione;
    }
    
    // Footer SOLO DA ADMIN
    formattedData.footer = {
      message: settings.messaggioRingraziamento, // NO DEFAULT
      promotionalMessage: settings.messaggioPromozionale,
      footerNote: settings.messaggioPiePagina
    };
    
    // QR Code e Social
    if (settings.mostraQRCode && settings.urlQRCode) {
      formattedData.qrCode = settings.urlQRCode;
    }
    
    // PASSA SEMPRE I SOCIAL SE CONFIGURATI
    if (settings.mostraSocial || settings.socialInstagram || settings.socialFacebook) {
      formattedData.social = {
        facebook: settings.socialFacebook,
        instagram: settings.socialInstagram
      };
    }
    
    // Impostazioni di stampa SOLO DA ADMIN
    formattedData.printSettings = {
      paperWidth: settings.larghezzaCarta,
      alignment: settings.allineamentoTitolo,
      separator: settings.carattereSeparatore,
      autoCut: settings.taglioAutomatico,
      copies: settings.numeroCopieScontrino,
      density: settings.densitaStampa
    };
    
    // Opzioni di visualizzazione SOLO DA ADMIN
    formattedData.displayOptions = {
      showDate: settings.mostraData,
      showTime: settings.mostraOra,
      showOperator: settings.mostraOperatore,
      showTable: settings.mostraTavolo,
      showOrderNumber: settings.mostraNumeroOrdine,
      showCustomer: settings.mostraCliente,
      showProductDetails: settings.mostraDettagliProdotti,
      showQuantity: settings.mostraQuantita,
      showUnitPrice: settings.mostraPrezzoUnitario,
      showLineTotal: settings.mostraTotaleRiga
    };
    
    // Formattazione valuta SOLO DA ADMIN
    formattedData.currencyFormat = {
      symbol: settings.simboloValuta,
      position: settings.posizioneValuta,
      decimalSeparator: settings.separatoreDecimale
    };
    
    return formattedData;
  }

  /**
   * Stampa scontrino automaticamente
   * Integrato con i dati del sistema cassa
   */
  async printReceipt(receiptData: any): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        console.warn('⚠️ Stampante non connessa - scontrino non stampato');
        return false;
      }

      // FORZA SEMPRE il caricamento delle impostazioni
      this.logDebug('=== INIZIO CARICAMENTO IMPOSTAZIONI ===');
      console.log('🔄 CARICAMENTO IMPOSTAZIONI DA ADMIN...');
      const settings = await this.loadReceiptSettings();
      console.log('📋 Settings caricate:', settings ? 'OK' : 'MANCANTI');
      
      if (settings) {
        this.logDebug('Impostazioni trovate:');
        this.logDebug('- Nome: ' + settings.nomeAttivita);
        this.logDebug('- Indirizzo: ' + settings.indirizzo);
        this.logDebug('- Messaggio: ' + settings.messaggioRingraziamento);
      } else {
        this.logDebug('ATTENZIONE: Nessuna impostazione caricata!');
      }
      this.logDebug('=== FINE CARICAMENTO IMPOSTAZIONI ===');
      
      // Converti i dati dal formato server al formato stampante
      const baseReceipt: ReceiptData = {
        numero: receiptData.numero || `SCO-${Date.now()}`,
        data: receiptData.data || new Date().toISOString(),
        tavolo: receiptData.tavolo,
        cameriere: receiptData.cameriere,
        nomeCliente: receiptData.nomeCliente,
        righe: receiptData.righe || [],
        totale: receiptData.totale || 0,
        pagamenti: receiptData.pagamenti || []
      };
      
      // Applica impostazioni personalizzate
      this.logDebug('Applicazione impostazioni al receipt...');
      const formattedReceipt = this.formatReceiptWithSettings(baseReceipt, settings);
      
      // LOG COMPLETO per debug
      console.log('📋 DATI COMPLETI PASSATI A STAMPANTE:');
      console.log('Header:', JSON.stringify(formattedReceipt.header));
      console.log('Footer:', JSON.stringify(formattedReceipt.footer));
      console.log('DisplayOptions:', JSON.stringify(formattedReceipt.displayOptions));
      console.log('PrintSettings:', JSON.stringify(formattedReceipt.printSettings));
      
      this.logDebug('Dati formattati per stampa:');
      this.logDebug('- Header business: ' + formattedReceipt.header?.businessName);
      this.logDebug('- Header address: ' + formattedReceipt.header?.address);
      this.logDebug('- Footer message: ' + formattedReceipt.footer?.message);

      console.log('🖨️ Stampa scontrino automatica:', formattedReceipt.numero);
      
      const success = await this.printer.printReceipt(formattedReceipt);
      
      // Se ci sono copie multiple, stampa le copie aggiuntive
      const copies = (formattedReceipt as any).printSettings?.copies || 1;
      if (success && copies > 1) {
        for (let i = 1; i < copies; i++) {
          console.log(`🖨️ Stampa copia ${i + 1} di ${copies}`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Pausa tra copie
          await this.printer.printReceipt(formattedReceipt);
        }
      }
      
      if (success) {
        this.updateStatus({ 
          lastPrint: new Date(),
          error: undefined 
        });
        console.log('✅ Scontrino stampato automaticamente');
      } else {
        this.updateStatus({ 
          error: 'Stampa scontrino fallita' 
        });
        console.error('❌ Stampa scontrino fallita');
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore stampa';
      this.updateStatus({ error: errorMessage });
      console.error('❌ Errore stampa scontrino:', error);
      return false;
    }
  }

  /**
   * Stampa scontrino con retry automatico
   */
  async printReceiptWithRetry(receiptData: any, maxRetries: number = 2): Promise<boolean> {
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        const success = await this.printReceipt(receiptData);
        if (success) return true;
        
        attempts++;
        
        if (attempts <= maxRetries) {
          console.log(`🔄 Retry stampa scontrino (${attempts}/${maxRetries})`);
          
          // Piccola pausa prima del retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Prova a riconnettersi se non connesso
          if (!this.isConnected()) {
            await this.connectPrinter();
          }
        }
      } catch (error) {
        attempts++;
        console.error(`❌ Errore tentativo ${attempts}:`, error);
        
        if (attempts > maxRetries) break;
      }
    }
    
    this.updateStatus({ 
      error: `Stampa fallita dopo ${maxRetries + 1} tentativi` 
    });
    
    return false;
  }

  /**
   * Verifica disponibilità Web Bluetooth
   */
  static isBluetoothSupported(): boolean {
    return NetumPrinter.isSupported();
  }

  /**
   * Ottieni info dispositivo
   */
  getDeviceInfo(): { name?: string; connected: boolean } {
    return this.printer.getDeviceInfo();
  }
}

// Export singleton instance per uso globale
export const printerService = new PrinterService();