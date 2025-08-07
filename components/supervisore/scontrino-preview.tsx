"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";

interface ScontrinoPreviewProps {
  impostazioni: any;
  isVisible?: boolean;
}

export default function ScontrinoPreview({ impostazioni, isVisible = true }: ScontrinoPreviewProps) {
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

  // Funzione per centrare il testo
  const alignText = (text: string, width: number, align: string = 'left') => {
    const textLength = text.length;
    if (textLength >= width) return text.substring(0, width);
    
    if (align === 'center') {
      const padding = Math.floor((width - textLength) / 2);
      return ' '.repeat(padding) + text;
    } else if (align === 'right') {
      return ' '.repeat(width - textLength) + text;
    }
    return text;
  };

  // Funzione per creare una linea separatrice
  const separator = (char: string = '-', width: number = 48) => {
    return char.repeat(width);
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
          <div className={`bg-white text-black p-6 rounded-lg shadow-lg overflow-auto ${isFullscreen ? 'max-h-[90vh]' : 'max-h-[800px]'}`}>
            {isFullscreen && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="mx-auto" style={{ maxWidth: `${paperWidth}ch` }}>
              <pre className="font-mono text-xs leading-relaxed whitespace-pre" style={{ fontSize: '11px', lineHeight: '1.4' }}>
            {/* Logo e intestazione */}
            {impostazioni.logoUrl && (
              <>
                <div className="text-center mb-2">
                  {impostazioni.logoUrl.includes('drive.google.com') ? (
                    // Per Google Drive, convertiamo l'URL
                    (() => {
                      const fileId = impostazioni.logoUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
                      const directUrl = fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : impostazioni.logoUrl;
                      return (
                        <img 
                          src={directUrl}
                          alt="Logo" 
                          className="mx-auto mb-2"
                          style={{ maxHeight: '60px', filter: 'grayscale(100%) contrast(150%)' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.insertAdjacentHTML('afterend', `<div>${alignText('[LOGO]', paperWidth, 'center')}</div>`);
                          }}
                        />
                      );
                    })()
                  ) : (
                    <img 
                      src={impostazioni.logoUrl} 
                      alt="Logo" 
                      className="mx-auto mb-2"
                      style={{ maxHeight: '60px', filter: 'grayscale(100%) contrast(150%)' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.insertAdjacentHTML('afterend', `<div>${alignText('[LOGO]', paperWidth, 'center')}</div>`);
                      }}
                    />
                  )}
                </div>
              </>
            )}
            
            {/* Nome attività */}
            <span className="font-bold text-sm">
              {alignText(impostazioni.nomeAttivita || 'Bar Roxy', paperWidth, impostazioni.allineamentoTitolo || 'center')}
            </span>
            {'\n'}
            
            {/* Indirizzo e contatti */}
            {impostazioni.indirizzo && (
              <>
                {alignText(impostazioni.indirizzo, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            {impostazioni.telefono && (
              <>
                {alignText(`Tel: ${impostazioni.telefono}`, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            {impostazioni.partitaIva && (
              <>
                {alignText(`P.IVA: ${impostazioni.partitaIva}`, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            {impostazioni.codiceFiscale && (
              <>
                {alignText(`C.F.: ${impostazioni.codiceFiscale}`, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            
            {/* Messaggio intestazione */}
            {impostazioni.messaggioIntestazione && (
              <>
                {'\n'}
                {alignText(impostazioni.messaggioIntestazione, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            
            {/* Separatore */}
            {'\n'}
            {separator(impostazioni.carattereSeparatore || '-', paperWidth)}
            {'\n'}
            
            {/* Info ordine */}
            {impostazioni.mostraNumeroOrdine && (
              <>
                {`SCONTRINO N. ${datiEsempio.numero}`}
                {'\n'}
              </>
            )}
            
            {/* Data e ora */}
            <div className="flex justify-between">
              {impostazioni.mostraData && formatDate(datiEsempio.data)}
              {impostazioni.mostraData && impostazioni.mostraOra && '  '}
              {impostazioni.mostraOra && formatTime(datiEsempio.data)}
            </div>
            {(impostazioni.mostraData || impostazioni.mostraOra) && '\n'}
            
            {/* Tavolo */}
            {impostazioni.mostraTavolo && (
              <>
                {`TAVOLO: ${datiEsempio.tavolo}`}
                {'\n'}
              </>
            )}
            
            {/* Cliente */}
            {impostazioni.mostraCliente && datiEsempio.cliente && (
              <>
                {`CLIENTE: ${datiEsempio.cliente}`}
                {'\n'}
              </>
            )}
            
            {/* Operatore */}
            {impostazioni.mostraOperatore && (
              <>
                {`OPERATORE: ${datiEsempio.operatore}`}
                {'\n'}
              </>
            )}
            
            {/* Separatore */}
            {separator(impostazioni.carattereSeparatore || '-', paperWidth)}
            {'\n'}
            
            {/* Intestazione prodotti */}
            {impostazioni.mostraDettagliProdotti && (
              <>
                <div className="flex justify-between">
                  <span className="font-bold">ARTICOLO</span>
                  {impostazioni.mostraQuantita && <span className="font-bold">QTÀ</span>}
                  {impostazioni.mostraPrezzoUnitario && <span className="font-bold">PREZZO</span>}
                  {impostazioni.mostraTotaleRiga && <span className="font-bold">TOTALE</span>}
                </div>
                {separator('-', paperWidth)}
                {'\n'}
              </>
            )}
            
            {/* Righe prodotti */}
            {datiEsempio.righe.map((riga, index) => (
              <div key={index}>
                {impostazioni.mostraDettagliProdotti ? (
                  <>
                    <div className="flex justify-between">
                      <span className="flex-1">{riga.nome}</span>
                    </div>
                    <div className="flex justify-between text-right">
                      {impostazioni.mostraQuantita && (
                        <span className="w-8">{riga.quantita}</span>
                      )}
                      {impostazioni.mostraPrezzoUnitario && (
                        <span className="w-16">{formatPrice(riga.prezzo)}</span>
                      )}
                      {impostazioni.mostraTotaleRiga && (
                        <span className="w-16 font-semibold">{formatPrice(riga.totale)}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>{riga.quantita}x {riga.nome}</span>
                    <span>{formatPrice(riga.totale)}</span>
                  </div>
                )}
              </div>
            ))}
            
            {/* Separatore */}
            {'\n'}
            {separator(impostazioni.carattereSeparatore || '-', paperWidth)}
            {'\n'}
            
            {/* Totali */}
            <div className="text-right">
              <div className="flex justify-between">
                <span>SUBTOTALE:</span>
                <span className="font-bold">{formatPrice(datiEsempio.subtotale)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-bold">TOTALE:</span>
                <span className="font-bold">{formatPrice(datiEsempio.totale)}</span>
              </div>
            </div>
            
            {/* Pagamento */}
            {'\n'}
            {separator(impostazioni.carattereSeparatore || '-', paperWidth)}
            {'\n'}
            <div className="text-right">
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
            
            {/* Separatore finale */}
            {'\n'}
            {separator('=', paperWidth)}
            {'\n'}
            
            {/* Messaggio ringraziamento */}
            {impostazioni.messaggioRingraziamento && (
              <>
                {'\n'}
                {alignText(impostazioni.messaggioRingraziamento, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            
            {/* Messaggio promozionale */}
            {impostazioni.messaggioPromozionale && (
              <>
                {'\n'}
                {alignText(impostazioni.messaggioPromozionale, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            
            {/* QR Code */}
            {impostazioni.mostraQRCode && impostazioni.urlQRCode && (
              <>
                {'\n'}
                {alignText('[QR CODE]', paperWidth, 'center')}
                {'\n'}
                {alignText(impostazioni.urlQRCode, paperWidth, 'center')}
                {'\n'}
              </>
            )}
            
            {/* Social */}
            {impostazioni.mostraSocial && (impostazioni.socialFacebook || impostazioni.socialInstagram) && (
              <>
                {'\n'}
                {separator('-', paperWidth)}
                {'\n'}
                {alignText('SEGUICI SU:', paperWidth, 'center')}
                {'\n'}
                {impostazioni.socialFacebook && (
                  <>
                    {alignText(`Facebook: ${impostazioni.socialFacebook}`, paperWidth, 'center')}
                    {'\n'}
                  </>
                )}
                {impostazioni.socialInstagram && (
                  <>
                    {alignText(`Instagram: ${impostazioni.socialInstagram}`, paperWidth, 'center')}
                    {'\n'}
                  </>
                )}
              </>
            )}
            
            {/* Barcode */}
            {impostazioni.mostraBarcode && (
              <>
                {'\n'}
                {alignText('||||| |||| | |||| ||||| |||||', paperWidth, 'center')}
                {'\n'}
                {alignText(datiEsempio.numero, paperWidth, 'center')}
              </>
            )}
            
            {/* Info fiscali */}
            {impostazioni.mostraInfoFiscali && (
              <>
                {'\n'}
                {separator('-', paperWidth)}
                {'\n'}
                {impostazioni.numeroRegistratore && (
                  <>
                    {`REG. N. ${impostazioni.numeroRegistratore}`}
                    {'\n'}
                  </>
                )}
                {impostazioni.matricolaFiscale && (
                  <>
                    {`MATR. ${impostazioni.matricolaFiscale}`}
                    {'\n'}
                  </>
                )}
              </>
            )}
            
            {/* Messaggio piè di pagina */}
            {impostazioni.messaggioPiePagina && (
              <>
                {'\n'}
                {alignText(impostazioni.messaggioPiePagina, paperWidth, 'center')}
              </>
            )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}