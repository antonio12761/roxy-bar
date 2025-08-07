"use client";

import { useState } from "react";
import { Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";

interface ScontrinoPreviewProps {
  impostazioni: any;
  isVisible?: boolean;
}

export default function ScontrinoPreviewV2({ impostazioni, isVisible = true }: ScontrinoPreviewProps) {
  const [showPreview, setShowPreview] = useState(isVisible);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Dati di esempio per la preview
  const datiEsempio = {
    numero: "2024-001234",
    data: new Date(),
    tavolo: "T3",
    operatore: "Mario Rossi",
    cliente: "Sig. Bianchi",
    righe: [
      { quantita: 2, nome: "Caffè Espresso", prezzo: 1.20, totale: 2.40 },
      { quantita: 1, nome: "Cappuccino", prezzo: 1.80, totale: 1.80 },
      { quantita: 1, nome: "Cornetto alla crema", prezzo: 1.50, totale: 1.50 },
      { quantita: 3, nome: "Succo d'arancia", prezzo: 2.50, totale: 7.50 },
      { quantita: 2, nome: "Tramezzino tonno", prezzo: 4.00, totale: 8.00 }
    ],
    subtotale: 21.20,
    totale: 21.20,
    pagamenti: [
      { modalita: "CONTANTI", importo: 30.00 }
    ],
    resto: 8.80
  };

  // Converti URL in URL diretto per vari servizi
  const getDirectImageUrl = (url: string) => {
    // Google Drive
    if (url.includes('drive.google.com')) {
      const fileId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }
    
    // Imgur - converti link pagina in link diretto
    if (url.includes('imgur.com')) {
      // Se è già un link diretto (i.imgur.com), restituiscilo
      if (url.includes('i.imgur.com')) {
        return url;
      }
      
      // Estrai l'ID dell'immagine da vari formati Imgur
      let imageId = null;
      
      // Formato: imgur.com/a/XXXXX o imgur.com/gallery/XXXXX
      const albumMatch = url.match(/imgur\.com\/(?:a|gallery)\/([a-zA-Z0-9]+)/);
      if (albumMatch) {
        // Per gli album, non possiamo ottenere automaticamente il link diretto
        // L'utente deve copiare il link diretto manualmente
        return url; // Restituiamo l'URL originale che causerà un errore
      }
      
      // Formato: imgur.com/XXXXX
      const directMatch = url.match(/imgur\.com\/([a-zA-Z0-9]+)(?:\.[a-z]+)?$/);
      if (directMatch) {
        imageId = directMatch[1];
        // Assumiamo PNG di default, ma potrebbe essere JPG
        return `https://i.imgur.com/${imageId}.png`;
      }
    }
    
    return url;
  };

  // Formatta prezzo secondo le impostazioni
  const formatPrice = (price: number) => {
    const formatted = price.toFixed(2).replace('.', impostazioni.separatoreDecimale || ',');
    if (impostazioni.posizioneValuta === 'prefix') {
      return `${impostazioni.simboloValuta || '€'}${formatted}`;
    }
    return `${formatted}${impostazioni.simboloValuta || '€'}`;
  };

  // Formatta data
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Formatta ora
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paperWidth = impostazioni.larghezzaCarta || 48;
  const separator = impostazioni.carattereSeparatore || '-';
  
  // Determina lo stile del font da utilizzare
  const getFontStyle = () => {
    switch(impostazioni.fontScontrino) {
      case 'poppins':
        return { fontFamily: 'var(--font-poppins), Poppins, sans-serif' };
      case 'inter':
        return { fontFamily: 'var(--font-inter), Inter, sans-serif' };
      case 'system':
        return { fontFamily: 'system-ui, -apple-system, sans-serif' };
      case 'mono':
      default:
        return { fontFamily: 'monospace' };
    }
  };

  return (
    <div className="w-full">
      {/* Toggle Buttons */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? 'Nascondi' : 'Mostra'} Preview
        </button>
        
        {showPreview && (
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? 'Riduci' : 'Espandi'}
          </button>
        )}
      </div>

      {showPreview && (
        <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8' : ''}`}>
          <div className={`bg-white text-black rounded-lg shadow-lg overflow-auto ${isFullscreen ? 'max-h-[90vh]' : 'max-h-[800px]'}`}>
            {isFullscreen && (
              <div className="flex justify-end p-2">
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              </div>
            )}
            
            {/* Receipt Container */}
            <div className="p-6" style={{ minWidth: '300px' }}>
              <div className="text-xs space-y-1" style={{ fontSize: '11px', lineHeight: '1.4', ...getFontStyle() }}>
                
                {/* Logo */}
                {impostazioni.logoUrl && (
                  <div className="text-center mb-3">
                    {impostazioni.logoUrl.includes('drive.google.com') ? (
                      // Per Google Drive mostriamo istruzioni alternative
                      <div className="border-2 border-dashed border-gray-400 p-3 mb-2">
                        <div className="text-xs text-gray-600 mb-2">
                          [LOGO - Google Drive]
                        </div>
                        <div className="text-xs text-gray-500">
                          Per visualizzare il logo da Google Drive:
                        </div>
                        <ol className="text-xs text-gray-500 text-left mt-1 ml-4">
                          <li>1. Usa un servizio come imgur.com</li>
                          <li>2. O carica su un hosting pubblico</li>
                          <li>3. O usa il link diretto dell'immagine</li>
                        </ol>
                        <div className="mt-2 text-xs">
                          <strong>URL attuale:</strong>
                          <div className="text-xs break-all">{impostazioni.logoUrl.substring(0, 50)}...</div>
                        </div>
                      </div>
                    ) : impostazioni.logoUrl.includes('imgur.com/a/') || impostazioni.logoUrl.includes('imgur.com/gallery/') ? (
                      // Per link album Imgur mostriamo istruzioni
                      <div className="border-2 border-dashed border-red-400 p-3 mb-2">
                        <div className="text-xs text-red-600 mb-2 font-bold">
                          ⚠️ Link Imgur non corretto
                        </div>
                        <div className="text-xs text-gray-600">
                          Hai copiato il link della pagina, non dell'immagine.
                        </div>
                        <div className="text-xs text-gray-600 mt-2 font-semibold">
                          Come ottenere il link corretto:
                        </div>
                        <ol className="text-xs text-gray-500 text-left mt-1 ml-4">
                          <li>1. Apri il tuo link: {impostazioni.logoUrl}</li>
                          <li>2. <strong>Fai clic destro sull'immagine</strong></li>
                          <li>3. Seleziona <strong>"Copia indirizzo immagine"</strong></li>
                          <li>4. Il link deve iniziare con: <strong>https://i.imgur.com/</strong></li>
                        </ol>
                        <div className="mt-2 p-2 bg-green-50 border border-green-300 rounded">
                          <div className="text-xs text-green-700">
                            <strong>Esempio link corretto:</strong>
                            <div className="font-mono">https://i.imgur.com/abc123.png</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img 
                        src={impostazioni.logoUrl}
                        alt="Logo" 
                        className="mx-auto"
                        style={{ 
                          maxHeight: '80px', 
                          maxWidth: '200px',
                          filter: 'grayscale(100%) contrast(150%)',
                          imageRendering: 'crisp-edges'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          // Invece di nascondere, mostriamo un placeholder
                          target.style.display = 'none';
                          const placeholder = document.createElement('div');
                          placeholder.className = 'text-center p-4 border-2 border-dashed border-gray-400';
                          placeholder.innerHTML = '<div class="text-xs text-gray-600">[LOGO NON DISPONIBILE]</div><div class="text-xs text-gray-500 mt-1">Verifica l\'URL dell\'immagine</div>';
                          target.parentElement?.appendChild(placeholder);
                        }}
                      />
                    )}
                  </div>
                )}
                
                {/* Business Name */}
                <div className="font-bold text-base mb-2" style={{ textAlign: impostazioni.allineamentoTitolo || 'center' }}>
                  {impostazioni.nomeAttivita || 'Bar Roxy'}
                </div>
                
                {/* Address and contacts */}
                {impostazioni.indirizzo && (
                  <div className="text-center">{impostazioni.indirizzo}</div>
                )}
                {impostazioni.telefono && (
                  <div className="text-center">Tel: {impostazioni.telefono}</div>
                )}
                {impostazioni.partitaIva && (
                  <div className="text-center">P.IVA: {impostazioni.partitaIva}</div>
                )}
                {impostazioni.codiceFiscale && (
                  <div className="text-center">C.F.: {impostazioni.codiceFiscale}</div>
                )}
                
                {/* Header message */}
                {impostazioni.messaggioIntestazione && (
                  <div className="text-center mt-2 mb-2 font-semibold">
                    {impostazioni.messaggioIntestazione}
                  </div>
                )}
                
                {/* Separator */}
                <div className="border-t-2 border-black my-2"></div>
                
                {/* Order info */}
                {impostazioni.mostraNumeroOrdine && (
                  <div>SCONTRINO N. {datiEsempio.numero}</div>
                )}
                
                {/* Date and time */}
                <div className="flex justify-between">
                  <div>
                    {impostazioni.mostraData && formatDate(datiEsempio.data)}
                    {impostazioni.mostraData && impostazioni.mostraOra && '  '}
                    {impostazioni.mostraOra && formatTime(datiEsempio.data)}
                  </div>
                </div>
                
                {/* Table */}
                {impostazioni.mostraTavolo && (
                  <div>TAVOLO: {datiEsempio.tavolo}</div>
                )}
                
                {/* Customer */}
                {impostazioni.mostraCliente && datiEsempio.cliente && (
                  <div>CLIENTE: {datiEsempio.cliente}</div>
                )}
                
                {/* Operator */}
                {impostazioni.mostraOperatore && (
                  <div>OPERATORE: {datiEsempio.operatore}</div>
                )}
                
                {/* Separator */}
                <div className="border-t border-black my-2"></div>
                
                {/* Products */}
                {impostazioni.mostraDettagliProdotti && (
                  <>
                    <div className="flex justify-between font-bold">
                      <span>ARTICOLO</span>
                      <span>QTÀ x PREZZO = TOTALE</span>
                    </div>
                    <div className="border-t border-gray-400 my-1"></div>
                  </>
                )}
                
                {/* Product lines */}
                {datiEsempio.righe.map((riga, index) => (
                  <div key={index} className="space-y-0.5">
                    <div>{riga.nome}</div>
                    <div className="flex justify-between pl-4 text-gray-700">
                      <span>
                        {impostazioni.mostraQuantita && `${riga.quantita} x `}
                        {impostazioni.mostraPrezzoUnitario && formatPrice(riga.prezzo)}
                      </span>
                      {impostazioni.mostraTotaleRiga && (
                        <span className="font-semibold">{formatPrice(riga.totale)}</span>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Separator */}
                <div className="border-t border-black my-2"></div>
                
                {/* Totals */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>SUBTOTALE:</span>
                    <span>{formatPrice(datiEsempio.subtotale)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTALE:</span>
                    <span>{formatPrice(datiEsempio.totale)}</span>
                  </div>
                </div>
                
                {/* Payment */}
                <div className="border-t border-black my-2"></div>
                <div className="space-y-1">
                  {datiEsempio.pagamenti.map((pag, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{pag.modalita}:</span>
                      <span>{formatPrice(pag.importo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold">
                    <span>RESTO:</span>
                    <span>{formatPrice(datiEsempio.resto)}</span>
                  </div>
                </div>
                
                {/* Final separator */}
                <div className="border-t-2 border-black my-2"></div>
                
                {/* Thank you message */}
                {impostazioni.messaggioRingraziamento && (
                  <div className="text-center font-bold mt-3">
                    {impostazioni.messaggioRingraziamento}
                  </div>
                )}
                
                {/* Promotional message */}
                {impostazioni.messaggioPromozionale && (
                  <div className="text-center mt-2 text-sm">
                    {impostazioni.messaggioPromozionale}
                  </div>
                )}
                
                {/* QR Code */}
                {impostazioni.mostraQRCode && impostazioni.urlQRCode && (
                  <div className="text-center mt-3">
                    <div className="border-2 border-black inline-block p-2">
                      <div className="text-xs">[ QR CODE ]</div>
                      <div className="text-xs mt-1">{impostazioni.urlQRCode}</div>
                    </div>
                  </div>
                )}
                
                {/* Social */}
                {impostazioni.mostraSocial && (impostazioni.socialFacebook || impostazioni.socialInstagram) && (
                  <div className="text-center mt-3 text-sm">
                    <div className="font-semibold">SEGUICI SU:</div>
                    {impostazioni.socialFacebook && (
                      <div>Facebook: {impostazioni.socialFacebook}</div>
                    )}
                    {impostazioni.socialInstagram && (
                      <div>Instagram: {impostazioni.socialInstagram}</div>
                    )}
                  </div>
                )}
                
                {/* Barcode */}
                {impostazioni.mostraBarcode && (
                  <div className="text-center mt-3">
                    <div className="font-mono text-lg tracking-wider">||||| |||| | |||| |||||</div>
                    <div className="text-xs">{datiEsempio.numero}</div>
                  </div>
                )}
                
                {/* Fiscal info */}
                {impostazioni.mostraInfoFiscali && (
                  <div className="mt-3 text-xs">
                    {impostazioni.numeroRegistratore && (
                      <div>REG. N. {impostazioni.numeroRegistratore}</div>
                    )}
                    {impostazioni.matricolaFiscale && (
                      <div>MATR. {impostazioni.matricolaFiscale}</div>
                    )}
                  </div>
                )}
                
                {/* Footer message */}
                {impostazioni.messaggioPiePagina && (
                  <div className="text-center mt-3 text-xs">
                    {impostazioni.messaggioPiePagina}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}