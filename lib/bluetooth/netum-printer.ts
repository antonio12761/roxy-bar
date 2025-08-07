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
    getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
  }
  
  interface BluetoothRemoteGATTService {
    device: BluetoothDevice;
    uuid: string;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
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

// UUID per stampante Netum NT-1809 - usa UUID proprietari
const PRINTER_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455"; // Servizio principale Netum
const PRINTER_WRITE_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";   // Write Characteristic
const PRINTER_NOTIFY_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";  // Notify Characteristic

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
  CHARSET_CP850: new Uint8Array([0x1B, 0x74, 0x02]), // ESC t - Codepage 850 (Europa occidentale)
  CHARSET_CP437: new Uint8Array([0x1B, 0x74, 0x00]), // ESC t - Codepage 437 (USA)
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
  // Nuovi campi per impostazioni personalizzate
  header?: {
    businessName?: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
    fiscalCode?: string;
  };
  headerMessage?: string;
  footer?: {
    message?: string;
    promotionalMessage?: string;
    footerNote?: string;
  };
  printSettings?: {
    paperWidth?: number;
    separator?: string;
    autoCut?: boolean;
  };
  displayOptions?: {
    showDate?: boolean;
    showTime?: boolean;
    showOperator?: boolean;
    showTable?: boolean;
    showOrderNumber?: boolean;
    showCustomer?: boolean;
  };
}

export class NetumPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isConnected = false;
  public onLog?: (message: string) => void;

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

      this.onLog?.('🔍 Ricerca stampante Netum NT-1809...');
      this.onLog?.(`📝 UUID utilizzati: service=${PRINTER_SERVICE_UUID}, write=${PRINTER_WRITE_UUID}`);
      
      try {
        // Prima prova con filtri specifici (come funzionava ieri)
        this.onLog?.('🔄 Ricerca con filtri specifici...');
        this.device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: 'NT-' },
            { namePrefix: 'NETUM' },
            { namePrefix: 'Printer' },
            { namePrefix: 'BT-' },
            { namePrefix: 'Thermal' },
            { namePrefix: 'POS' },
            { namePrefix: '58' },
            { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] },
          ],
          optionalServices: [
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '00001101-0000-1000-8000-00805f9b34fb',
          ]
        });
      } catch (filteredError) {
        // Se i filtri falliscono, mostra tutti i dispositivi
        this.onLog?.('⚠️ Filtri specifici falliti, mostro tutti i dispositivi...');
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '00001101-0000-1000-8000-00805f9b34fb',
          ]
        });
      }

      this.onLog?.(`📱 Trovato dispositivo: ${this.device.name}`);

      // Connetti al server GATT
      this.onLog?.('🔗 Connessione al server GATT...');
      this.server = await this.device.gatt!.connect();
      this.onLog?.('✅ Connesso al server GATT');

      // Prova a elencare TUTTI i servizi disponibili
      this.onLog?.('📋 Ricerca servizi disponibili...');
      try {
        const services = await this.server.getPrimaryServices();
        this.onLog?.(`📦 Trovati ${services.length} servizi:`);
        for (const service of services) {
          this.onLog?.(`  - Service UUID: ${service.uuid}`);
        }
      } catch (err) {
        this.onLog?.(`⚠️ Impossibile elencare servizi: ${err}`);
      }

      // Prova diversi UUID per il servizio
      let serviceFound = false;
      const serviceUUIDs = [
        PRINTER_SERVICE_UUID, // UUID principale Netum
        '000018f0-0000-1000-8000-00805f9b34fb', // Generico
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Altro servizio trovato
      ];

      for (const uuid of serviceUUIDs) {
        try {
          this.onLog?.(`🔍 Provo servizio UUID: ${uuid}`);
          this.service = await this.server.getPrimaryService(uuid);
          this.onLog?.(`✅ Servizio trovato con UUID: ${uuid}`);
          serviceFound = true;
          
          // Elenca tutte le caratteristiche del servizio per debug
          try {
            const characteristics = await this.service.getCharacteristics();
            this.onLog?.(`  📋 Trovate ${characteristics.length} caratteristiche:`);
            for (const char of characteristics) {
              const props = [];
              if (char.properties.read) props.push('read');
              if (char.properties.write) props.push('write');
              if (char.properties.writeWithoutResponse) props.push('writeWithoutResponse');
              if (char.properties.notify) props.push('notify');
              this.onLog?.(`    - ${char.uuid} [${props.join(', ')}]`);
            }
          } catch (err) {
            this.onLog?.(`  ⚠️ Impossibile elencare caratteristiche: ${err}`);
          }
          
          // Prova a ottenere caratteristica di scrittura
          const writeUUIDs = [
            PRINTER_WRITE_UUID, // Write Characteristic Netum
            '49535343-8841-43f4-a8d4-ecbe34729bb3', // Altro UUID write
            '49535343-8841-43f4-a8e7-9311c0cb7f06', // Legacy write
          ];
          
          for (const writeUuid of writeUUIDs) {
            try {
              this.onLog?.(`  🔍 Provo caratteristica write UUID: ${writeUuid}`);
              this.writeCharacteristic = await this.service.getCharacteristic(writeUuid);
              this.onLog?.(`  ✅ Caratteristica write trovata: ${writeUuid}`);
              break;
            } catch (err) {
              this.onLog?.(`  ❌ Caratteristica ${writeUuid} non trovata`);
            }
          }
          
          // Se abbiamo trovato la caratteristica di scrittura, esci
          if (this.writeCharacteristic) {
            break;
          }
        } catch (err) {
          this.onLog?.(`❌ Servizio ${uuid} non trovato`);
        }
      }

      if (!serviceFound) {
        throw new Error('Nessun servizio stampante compatibile trovato');
      }

      if (!this.writeCharacteristic) {
        throw new Error('Nessuna caratteristica di scrittura trovata');
      }

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
   * Converte caratteri speciali per codifica CP437/CP850
   */
  private convertTextForPrinter(text: string): Uint8Array {
    // Mappa caratteri speciali per stampanti termiche
    const charMap: { [key: string]: number } = {
      '€': 0xD5,  // Simbolo Euro in CP850
      '£': 0x9C,  // Simbolo Sterlina
      'à': 0x85,  // a con accento grave
      'è': 0x8A,  // e con accento grave
      'é': 0x82,  // e con accento acuto
      'ì': 0x8D,  // i con accento grave
      'ò': 0x95,  // o con accento grave
      'ù': 0x97,  // u con accento grave
      'À': 0xB7,  // A con accento grave
      'È': 0xD4,  // E con accento grave
      'É': 0x90,  // E con accento acuto
      'Ì': 0xDE,  // I con accento grave
      'Ò': 0xE3,  // O con accento grave
      'Ù': 0xEB,  // U con accento grave
    };

    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (charMap[char]) {
        bytes.push(charMap[char]);
      } else {
        const code = text.charCodeAt(i);
        if (code < 128) {
          bytes.push(code);
        } else {
          // Sostituisci caratteri non supportati con '?'
          bytes.push(0x3F);
        }
      }
    }
    return new Uint8Array(bytes);
  }

  /**
   * Invia testo alla stampante
   */
  private async sendText(text: string): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error('Stampante non connessa');
    }

    try {
      // Converte testo con codifica corretta per stampante termica
      const data = this.convertTextForPrinter(text);
      
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
    // Usa EUR invece del simbolo € per evitare problemi di codifica
    return `EUR ${amount.toFixed(2)}`;
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


      // VERIFICA CHE CI SIANO LE IMPOSTAZIONI DA ADMIN
      if (!receiptData.header?.businessName) {
        console.error('❌ ERRORE: Nome attività non configurato!');
        console.error('Vai in admin/scontrino e configura le impostazioni');
        throw new Error('Impostazioni scontrino non configurate');
      }

      // Inizializza stampante
      await this.sendCommand(ESC_POS.INIT);
      await this.sendCommand(ESC_POS.CHARSET_CP850);
      
      // NOME ATTIVITÀ - VERSIONE SEMPLICE
      const businessName = receiptData.header.businessName;
      
      // Stampa nome attività in grande e bold
      await this.sendCommand(ESC_POS.DOUBLE_SIZE);
      await this.sendCommand(ESC_POS.BOLD_ON);
      await this.printCentered(businessName.toUpperCase(), false); // FALSE perché bold già attivo!
      await this.sendCommand(ESC_POS.BOLD_OFF);
      await this.sendCommand(ESC_POS.NORMAL_SIZE);
      
      // Informazioni attività
      if (receiptData.header?.address) {
        await this.printCentered(receiptData.header.address);
      }
      if (receiptData.header?.phone) {
        await this.printCentered(`Tel: ${receiptData.header.phone}`);
      }
      if (receiptData.header?.vatNumber) {
        await this.printCentered(`P.IVA: ${receiptData.header.vatNumber}`);
      }
      if (receiptData.header?.fiscalCode) {
        await this.printCentered(`C.F.: ${receiptData.header.fiscalCode}`);
      }
      
      // Messaggio intestazione personalizzato (es. SCONTRINO NON FISCALE)
      if (receiptData.headerMessage) {
        await this.sendCommand(ESC_POS.NEW_LINE);
        await this.sendCommand(ESC_POS.BOLD_ON);
        await this.printCentered(receiptData.headerMessage, false); // FALSE perché bold già attivo!
        await this.sendCommand(ESC_POS.BOLD_OFF);
      }
      
      await this.sendCommand(ESC_POS.NEW_LINE);
      
      // Separatore SOLO DA ADMIN
      const separator = receiptData.printSettings?.separator;
      if (separator) {
        await this.printSeparatorLine(separator);
      } else {
        await this.printSeparatorLine('='); // Solo questo default per non rompere il layout
      }
      
      // Informazioni ordine SOLO SE ABILITATO IN ADMIN
      const opts = receiptData.displayOptions || {};
      
      if (opts.showOrderNumber) {
        await this.sendText(`Scontrino: ${receiptData.numero}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      if (opts.showDate) {
        await this.sendText(`Data: ${this.formatDate(receiptData.data)}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      if (receiptData.tavolo && opts.showTable) {
        await this.sendText(`Tavolo: ${receiptData.tavolo}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      if (receiptData.cameriere && opts.showOperator) {
        await this.sendText(`Cameriere: ${receiptData.cameriere}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      if (receiptData.nomeCliente && opts.showCustomer) {
        await this.sendText(`Cliente: ${receiptData.nomeCliente}`);
        await this.sendCommand(ESC_POS.NEW_LINE);
      }
      
      // Separatore articoli
      await this.printSeparatorLine('-');
      
      // Righe ordine
      if (receiptData.righe && receiptData.righe.length > 0) {
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
      
      // Footer SOLO DA ADMIN
      await this.sendCommand(ESC_POS.NEW_LINE);
      if (separator) {
        await this.printSeparatorLine(separator);
      }
      
      // Messaggio SOLO SE CONFIGURATO IN ADMIN
      if (receiptData.footer?.message) {
        await this.sendCommand(ESC_POS.BOLD_ON);
        await this.printCentered(receiptData.footer.message, false); // FALSE perché bold già attivo!
        await this.sendCommand(ESC_POS.BOLD_OFF);
      }
      
      // Messaggio promozionale (es. Instagram)
      if (receiptData.footer?.promotionalMessage) {
        await this.sendCommand(ESC_POS.NEW_LINE);
        await this.printCentered(receiptData.footer.promotionalMessage);
      }
      
      // Social media se configurati
      if ((receiptData as any).social?.instagram) {
        await this.printCentered(`Instagram: ${(receiptData as any).social.instagram}`);
      }
      if ((receiptData as any).social?.facebook) {
        await this.printCentered(`Facebook: ${(receiptData as any).social.facebook}`);
      }
      
      // Nota a piè di pagina (es. sito web)
      if (receiptData.footer?.footerNote) {
        await this.sendCommand(ESC_POS.NEW_LINE);
        await this.printCentered(receiptData.footer.footerNote);
      }
      
      await this.sendCommand(ESC_POS.NEW_LINE);
      
      // Feed e taglia SOLO SE ABILITATO IN ADMIN
      await this.sendCommand(ESC_POS.FEED_LINE);
      if (receiptData.printSettings?.autoCut === true) {
        await this.sendCommand(ESC_POS.CUT);
      }
      
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