"use client";

/**
 * Modulo per gestione stampante termica Netum NT-1809
 * Compatibile con Web Bluetooth API per PWA Android
 * Supporta comandi ESC/POS per stampa scontrini
 */

// Type declarations for Web Bluetooth API
declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
  
  interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    getAvailability(): Promise<boolean>;
  }
  
  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
  }
  
  interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[];
    name?: string;
    namePrefix?: string;
  }
  
  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  }
  
  interface BluetoothRemoteGATTServer {
    device: BluetoothDevice;
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  }
  
  interface BluetoothRemoteGATTService {
    device: BluetoothDevice;
    uuid: string;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  
  interface BluetoothRemoteGATTCharacteristic {
    service: BluetoothRemoteGATTService;
    uuid: string;
    properties: BluetoothCharacteristicProperties;
    value?: DataView;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
  }
  
  interface BluetoothCharacteristicProperties {
    broadcast: boolean;
    read: boolean;
    writeWithoutResponse: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
    authenticatedSignedWrites: boolean;
    reliableWrite: boolean;
    writableAuxiliaries: boolean;
  }
  
  type BluetoothServiceUUID = number | string;
  type BluetoothCharacteristicUUID = number | string;
}

// UUID standard per stampanti termiche Bluetooth
const PRINTER_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const PRINTER_WRITE_UUID = "49535343-8841-43f4-a8e7-9311c0cb7f06";

// Comandi ESC/POS per Netum NT-1809
const ESC_POS = {
  // Controllo stampante
  INIT: new Uint8Array([0x1B, 0x40]), // ESC @
  CUT: new Uint8Array([0x1D, 0x56, 0x00]), // GS V m
  
  // Formattazione testo
  BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]), // ESC E
  BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]),
  CENTER: new Uint8Array([0x1B, 0x61, 0x01]), // ESC a
  LEFT: new Uint8Array([0x1B, 0x61, 0x00]),
  RIGHT: new Uint8Array([0x1B, 0x61, 0x02]),
  
  // Dimensioni testo
  NORMAL_SIZE: new Uint8Array([0x1D, 0x21, 0x00]), // GS !
  DOUBLE_SIZE: new Uint8Array([0x1D, 0x21, 0x11]),
  DOUBLE_WIDTH: new Uint8Array([0x1D, 0x21, 0x10]),
  DOUBLE_HEIGHT: new Uint8Array([0x1D, 0x21, 0x01]),
  
  // Linee e separatori
  NEW_LINE: new Uint8Array([0x0A]),
  FEED_LINE: new Uint8Array([0x1B, 0x64, 0x02]), // ESC d (2 linee)
  
  // Codifica caratteri
  CHARSET_ITALIAN: new Uint8Array([0x1B, 0x52, 0x07]), // ESC R (Italia)
} as const;

export interface OrderItem {
  nome: string;
  quantita: number;
  prezzo: number;
  totale: number;
}

export interface Payment {
  metodo: string;
  importo: number;
}

export interface ReceiptData {
  numero: string;
  data: string;
  tavolo?: string;
  cameriere?: string;
  righe: OrderItem[];
  totale: number;
  pagamenti: Payment[];
  nomeCliente?: string;
}

export class NetumPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isConnected = false;

  constructor() {
    // Verifica supporto Web Bluetooth
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      console.warn('Web Bluetooth non supportato');
    }
  }

  /**
   * Verifica se Web Bluetooth è supportato
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 
           'bluetooth' in navigator &&
           typeof navigator.bluetooth.requestDevice === 'function';
  }

  /**
   * Connetti alla stampante Netum NT-1809
   */
  async connect(): Promise<boolean> {
    try {
      if (!NetumPrinter.isSupported()) {
        throw new Error('Web Bluetooth non supportato in questo browser');
      }

      console.log('🔍 Ricerca stampante Netum NT-1809...');
      
      try {
        // Prima prova con filtri specifici
        this.device = await navigator.bluetooth.requestDevice({
          // Filtri più ampi per stampanti termiche
          filters: [
            { namePrefix: 'NT-' },
            { namePrefix: 'NETUM' },
            { namePrefix: 'Printer' },
            { namePrefix: 'BT-' },
            { namePrefix: 'Thermal' },
            { namePrefix: 'POS' },
            { namePrefix: '58' }, // Molte stampanti 58mm iniziano con "58"
          ],
          optionalServices: [
            PRINTER_SERVICE_UUID,
            '000018f0-0000-1000-8000-00805f9b34fb', // Service UUID alternativo
            '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Service UUID alternativo Netum
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Nordic UART service
          ]
        });
      } catch (filteredError) {
        console.warn('⚠️ Filtri specifici falliti, mostro tutti i dispositivi:', filteredError);
        
        // Fallback: mostra tutti i dispositivi disponibili
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            PRINTER_SERVICE_UUID,
            '000018f0-0000-1000-8000-00805f9b34fb',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
          ]
        });
      }

      console.log(`📱 Trovato dispositivo: ${this.device.name}`);

      // Connetti al server GATT
      this.server = await this.device.gatt!.connect();
      console.log('🔗 Connesso al server GATT');

      // Ottieni servizio stampante
      this.service = await this.server.getPrimaryService(PRINTER_SERVICE_UUID);
      console.log('⚡ Servizio stampante ottenuto');

      // Ottieni caratteristica di scrittura
      this.writeCharacteristic = await this.service.getCharacteristic(PRINTER_WRITE_UUID);
      console.log('✍️ Caratteristica di scrittura ottenuta');

      // Gestisci disconnessione
      this.device.addEventListener('gattserverdisconnected', () => {
        console.log('🔌 Stampante disconnessa');
        this.isConnected = false;
      });

      this.isConnected = true;
      console.log('✅ Connessione alla stampante riuscita');
      
      // Test di connessione - inizializza stampante
      await this.sendCommand(ESC_POS.INIT);
      
      return true;
    } catch (error) {
      console.error('❌ Errore connessione stampante:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnetti dalla stampante
   */
  async disconnect(): Promise<void> {
    try {
      if (this.server && this.server.connected) {
        await this.server.disconnect();
      }
      this.device = null;
      this.server = null;
      this.service = null;
      this.writeCharacteristic = null;
      this.isConnected = false;
      console.log('📴 Stampante disconnessa');
    } catch (error) {
      console.error('Errore disconnessione:', error);
    }
  }

  /**
   * Verifica se la stampante è connessa
   */
  getConnectionStatus(): boolean {
    return this.isConnected && 
           this.server?.connected === true && 
           this.writeCharacteristic !== null;
  }

  /**
   * Invia comando alla stampante
   */
  private async sendCommand(command: Uint8Array): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error('Stampante non connessa');
    }

    try {
      await this.writeCharacteristic.writeValue(command);
      // Piccolo delay per evitare overflow del buffer
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      console.error('Errore invio comando:', error);
      throw error;
    }
  }

  /**
   * Invia testo alla stampante
   */
  private async sendText(text: string): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error('Stampante non connessa');
    }

    try {
      // Converte testo in bytes UTF-8
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      // Invia in chunks per evitare overflow (max 20 bytes per volta)
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.writeCharacteristic.writeValue(chunk);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error('Errore invio testo:', error);
      throw error;
    }
  }

  /**
   * Stampa una linea di separazione
   */
  private async printSeparatorLine(char: string = '-'): Promise<void> {
    const line = char.repeat(32); // 32 caratteri per carta 58mm
    await this.sendText(line);
    await this.sendCommand(ESC_POS.NEW_LINE);
  }

  /**
   * Stampa testo centrato
   */
  private async printCentered(text: string, bold: boolean = false): Promise<void> {
    await this.sendCommand(ESC_POS.CENTER);
    if (bold) await this.sendCommand(ESC_POS.BOLD_ON);
    
    await this.sendText(text);
    await this.sendCommand(ESC_POS.NEW_LINE);
    
    if (bold) await this.sendCommand(ESC_POS.BOLD_OFF);
    await this.sendCommand(ESC_POS.LEFT);
  }

  /**
   * Stampa una riga con testo a sinistra e prezzo a destra
   */
  private async printLineItem(name: string, price: string): Promise<void> {
    const maxWidth = 32;
    const priceWidth = price.length;
    const nameWidth = Math.max(1, maxWidth - priceWidth - 1);
    
    // Tronca il nome se troppo lungo
    const truncatedName = name.length > nameWidth 
      ? name.substring(0, nameWidth - 3) + '...'
      : name;
    
    // Riempi con spazi
    const spaces = ' '.repeat(maxWidth - truncatedName.length - priceWidth);
    const line = truncatedName + spaces + price;
    
    await this.sendText(line);
    await this.sendCommand(ESC_POS.NEW_LINE);
  }

  /**
   * Formatta prezzo per visualizzazione
   */
  private formatPrice(amount: number): string {
    return `€${amount.toFixed(2)}`;
  }

  /**
   * Formatta data per scontrino
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Stampa scontrino completo
   */
  async printReceipt(receiptData: ReceiptData): Promise<boolean> {
    try {
      if (!this.getConnectionStatus()) {
        throw new Error('Stampante non connessa');
      }

      console.log('🖨️ Inizio stampa scontrino:', receiptData.numero);

      // Inizializza stampante
      await this.sendCommand(ESC_POS.INIT);
      await this.sendCommand(ESC_POS.CHARSET_ITALIAN);
      
      // Header - Nome bar/ristorante
      await this.sendCommand(ESC_POS.DOUBLE_SIZE);
      await this.printCentered('BAR ROXY', true);
      await this.sendCommand(ESC_POS.NORMAL_SIZE);
      
      await this.printCentered('Gestionale Bar');
      await this.sendCommand(ESC_POS.NEW_LINE);
      
      // Separatore
      await this.printSeparatorLine('=');
      
      // Informazioni ordine
      await this.sendText(`Scontrino: ${receiptData.numero}`);
      await this.sendCommand(ESC_POS.NEW_LINE);
      
      await this.sendText(`Data: ${this.formatDate(receiptData.data)}`);
      await this.sendCommand(ESC_POS.NEW_LINE);
      
      if (receiptData.tavolo) {
        await this.sendText(`Tavolo: ${receiptData.tavolo}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      if (receiptData.cameriere) {
        await this.sendText(`Cameriere: ${receiptData.cameriere}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      if (receiptData.nomeCliente) {
        await this.sendText(`Cliente: ${receiptData.nomeCliente}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      // Separatore articoli
      await this.printSeparatorLine('-');
      
      // Righe ordine
      for (const riga of receiptData.righe) {
        // Nome prodotto e quantità
        const itemLine = riga.quantita > 1 
          ? `${riga.nome} x${riga.quantita}`
          : riga.nome;
        
        await this.printLineItem(itemLine, this.formatPrice(riga.totale));
        
        // Se quantità > 1, mostra prezzo unitario
        if (riga.quantita > 1) {
          await this.sendText(`  ${this.formatPrice(riga.prezzo)} cad.`);
          await this.sendCommand(ESC_POS.NEW_LINE);
        }
      }
      
      // Separatore totale
      await this.printSeparatorLine('-');
      
      // Totale
      await this.sendCommand(ESC_POS.BOLD_ON);
      await this.printLineItem('TOTALE', this.formatPrice(receiptData.totale));
      await this.sendCommand(ESC_POS.BOLD_OFF);
      
      // Pagamenti
      if (receiptData.pagamenti && receiptData.pagamenti.length > 0) {
        await this.sendCommand(ESC_POS.NEW_LINE);
        await this.sendText('Pagato con:');
        await this.sendCommand(ESC_POS.NEW_LINE);
        
        for (const pagamento of receiptData.pagamenti) {
          await this.printLineItem(
            pagamento.metodo, 
            this.formatPrice(pagamento.importo)
          );
        }
      }
      
      // Footer
      await this.sendCommand(ESC_POS.NEW_LINE);
      await this.printSeparatorLine('=');
      await this.printCentered('Grazie per la visita!');
      await this.sendCommand(ESC_POS.NEW_LINE);
      
      // Feed e taglia
      await this.sendCommand(ESC_POS.FEED_LINE);
      await this.sendCommand(ESC_POS.CUT);
      
      console.log('✅ Scontrino stampato con successo');
      return true;
      
    } catch (error) {
      console.error('❌ Errore stampa scontrino:', error);
      return false;
    }
  }

  /**
   * Test di stampa per verificare connessione
   */
  async printTest(): Promise<boolean> {
    try {
      if (!this.getConnectionStatus()) {
        throw new Error('Stampante non connessa');
      }

      await this.sendCommand(ESC_POS.INIT);
      await this.printCentered('TEST CONNESSIONE', true);
      await this.printCentered('Netum NT-1809');
      await this.sendCommand(ESC_POS.NEW_LINE);
      await this.sendText(`Data: ${new Date().toLocaleString('it-IT')}`);
      await this.sendCommand(ESC_POS.NEW_LINE);
      await this.printSeparatorLine('-');
      await this.printCentered('Test completato!');
      await this.sendCommand(ESC_POS.FEED_LINE);
      await this.sendCommand(ESC_POS.CUT);
      
      console.log('✅ Test di stampa completato');
      return true;
    } catch (error) {
      console.error('❌ Errore test stampa:', error);
      return false;
    }
  }

  /**
   * Ottieni informazioni dispositivo connesso
   */
  getDeviceInfo(): { name?: string; connected: boolean } {
    return {
      name: this.device?.name,
      connected: this.getConnectionStatus()
    };
  }
}

// Export singleton instance
export const netumPrinter = new NetumPrinter();