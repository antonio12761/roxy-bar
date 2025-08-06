"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  Save, 
  Loader2, 
  FileText, 
  Image, 
  Type, 
  CreditCard,
  MessageSquare,
  Printer,
  QrCode,
  Share2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";

interface ImpostazioniScontrino {
  id?: string;
  // Intestazione
  logoUrl?: string;
  nomeAttivita: string;
  indirizzo?: string;
  telefono?: string;
  partitaIva?: string;
  codiceFiscale?: string;
  
  // Layout e grafica
  larghezzaCarta: number;
  allineamentoTitolo: string;
  carattereSeparatore: string;
  mostraData: boolean;
  mostraOra: boolean;
  mostraOperatore: boolean;
  mostraTavolo: boolean;
  mostraNumeroOrdine: boolean;
  
  // Messaggi personalizzati
  messaggioIntestazione?: string;
  messaggioRingraziamento: string;
  messaggioPromozionale?: string;
  messaggioPiePagina?: string;
  
  // Formattazione prezzi
  mostraDettagliProdotti: boolean;
  mostraQuantita: boolean;
  mostraPrezzoUnitario: boolean;
  mostraTotaleRiga: boolean;
  separatoreDecimale: string;
  simboloValuta: string;
  posizioneValuta: string;
  
  // Footer
  mostraBarcode: boolean;
  mostraQRCode: boolean;
  urlQRCode?: string;
  mostraSocial: boolean;
  socialFacebook?: string;
  socialInstagram?: string;
  
  // Scontrino fiscale
  mostraInfoFiscali: boolean;
  numeroRegistratore?: string;
  matricolaFiscale?: string;
  
  // Impostazioni avanzate
  taglioAutomatico: boolean;
  numeroCopieScontrino: number;
  ritardoTaglio: number;
  densitaStampa: number;
}

export default function ImpostazioniScontrinoComponent() {
  const [impostazioni, setImpostazioni] = useState<ImpostazioniScontrino>({
    nomeAttivita: "Bar Roxy",
    larghezzaCarta: 48,
    allineamentoTitolo: "center",
    carattereSeparatore: "-",
    mostraData: true,
    mostraOra: true,
    mostraOperatore: true,
    mostraTavolo: true,
    mostraNumeroOrdine: true,
    messaggioRingraziamento: "Grazie per la visita!",
    mostraDettagliProdotti: true,
    mostraQuantita: true,
    mostraPrezzoUnitario: true,
    mostraTotaleRiga: true,
    separatoreDecimale: ",",
    simboloValuta: "€",
    posizioneValuta: "suffix",
    mostraBarcode: false,
    mostraQRCode: false,
    mostraSocial: false,
    mostraInfoFiscali: false,
    taglioAutomatico: true,
    numeroCopieScontrino: 1,
    ritardoTaglio: 100,
    densitaStampa: 2
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["intestazione", "layout", "messaggi"])
  );

  useEffect(() => {
    loadImpostazioni();
  }, []);

  const loadImpostazioni = async () => {
    try {
      const response = await fetch("/api/impostazioni-scontrino");
      const result = await response.json();
      
      if (result.success && result.data) {
        setImpostazioni(result.data);
      }
    } catch (error) {
      console.error("Errore caricamento impostazioni:", error);
      toast.error("Errore nel caricamento delle impostazioni");
    } finally {
      setIsLoading(false);
    }
  };

  const saveImpostazioni = async () => {
    setIsSaving(true);
    try {
      const method = impostazioni.id ? "PUT" : "POST";
      const response = await fetch("/api/impostazioni-scontrino", {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(impostazioni)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success("Impostazioni salvate con successo");
        if (result.data) {
          setImpostazioni(result.data);
        }
      } else {
        toast.error(result.error || "Errore nel salvataggio");
      }
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast.error("Errore nel salvataggio delle impostazioni");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleInputChange = (field: string, value: any) => {
    setImpostazioni(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-purple-400" />
          <h2 className="text-xl font-bold">Configurazione Scontrino</h2>
        </div>
        <button
          onClick={saveImpostazioni}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg transition-colors"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva Impostazioni
        </button>
      </div>

      {/* Intestazione */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("intestazione")}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold">Intestazione Scontrino</h3>
          </div>
          {expandedSections.has("intestazione") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.has("intestazione") && (
          <div className="p-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome Attività</label>
                <input
                  type="text"
                  value={impostazioni.nomeAttivita}
                  onChange={(e) => handleInputChange("nomeAttivita", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Logo URL</label>
                <input
                  type="text"
                  value={impostazioni.logoUrl || ""}
                  onChange={(e) => handleInputChange("logoUrl", e.target.value)}
                  placeholder="https://esempio.com/logo.png"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Indirizzo</label>
                <input
                  type="text"
                  value={impostazioni.indirizzo || ""}
                  onChange={(e) => handleInputChange("indirizzo", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Telefono</label>
                <input
                  type="text"
                  value={impostazioni.telefono || ""}
                  onChange={(e) => handleInputChange("telefono", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Partita IVA</label>
                <input
                  type="text"
                  value={impostazioni.partitaIva || ""}
                  onChange={(e) => handleInputChange("partitaIva", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Codice Fiscale</label>
                <input
                  type="text"
                  value={impostazioni.codiceFiscale || ""}
                  onChange={(e) => handleInputChange("codiceFiscale", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Layout e Grafica */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("layout")}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Type className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold">Layout e Grafica</h3>
          </div>
          {expandedSections.has("layout") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.has("layout") && (
          <div className="p-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Larghezza Carta (caratteri)</label>
                <input
                  type="number"
                  value={impostazioni.larghezzaCarta}
                  onChange={(e) => handleInputChange("larghezzaCarta", parseInt(e.target.value))}
                  min="32"
                  max="80"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Allineamento Titolo</label>
                <select
                  value={impostazioni.allineamentoTitolo}
                  onChange={(e) => handleInputChange("allineamentoTitolo", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="left">Sinistra</option>
                  <option value="center">Centro</option>
                  <option value="right">Destra</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Carattere Separatore</label>
                <input
                  type="text"
                  value={impostazioni.carattereSeparatore}
                  onChange={(e) => handleInputChange("carattereSeparatore", e.target.value)}
                  maxLength={1}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraData}
                  onChange={(e) => handleInputChange("mostraData", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra Data</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraOra}
                  onChange={(e) => handleInputChange("mostraOra", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra Ora</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraOperatore}
                  onChange={(e) => handleInputChange("mostraOperatore", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra Operatore</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraTavolo}
                  onChange={(e) => handleInputChange("mostraTavolo", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra Tavolo</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraNumeroOrdine}
                  onChange={(e) => handleInputChange("mostraNumeroOrdine", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra N° Ordine</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Messaggi Personalizzati */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("messaggi")}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold">Messaggi Personalizzati</h3>
          </div>
          {expandedSections.has("messaggi") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.has("messaggi") && (
          <div className="p-4 border-t border-border space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Messaggio Intestazione</label>
              <textarea
                value={impostazioni.messaggioIntestazione || ""}
                onChange={(e) => handleInputChange("messaggioIntestazione", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Messaggio sotto l'intestazione (opzionale)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Messaggio Ringraziamento</label>
              <input
                type="text"
                value={impostazioni.messaggioRingraziamento}
                onChange={(e) => handleInputChange("messaggioRingraziamento", e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Messaggio Promozionale</label>
              <textarea
                value={impostazioni.messaggioPromozionale || ""}
                onChange={(e) => handleInputChange("messaggioPromozionale", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Promozioni o offerte speciali (opzionale)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Messaggio Piè di Pagina</label>
              <textarea
                value={impostazioni.messaggioPiePagina || ""}
                onChange={(e) => handleInputChange("messaggioPiePagina", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Messaggio finale (opzionale)"
              />
            </div>
          </div>
        )}
      </div>

      {/* Formattazione Prezzi */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("prezzi")}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold">Formattazione Prezzi</h3>
          </div>
          {expandedSections.has("prezzi") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.has("prezzi") && (
          <div className="p-4 border-t border-border space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraDettagliProdotti}
                  onChange={(e) => handleInputChange("mostraDettagliProdotti", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Dettagli Prodotti</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraQuantita}
                  onChange={(e) => handleInputChange("mostraQuantita", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Quantità</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraPrezzoUnitario}
                  onChange={(e) => handleInputChange("mostraPrezzoUnitario", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Prezzo Unitario</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraTotaleRiga}
                  onChange={(e) => handleInputChange("mostraTotaleRiga", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Totale Riga</span>
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Simbolo Valuta</label>
                <input
                  type="text"
                  value={impostazioni.simboloValuta}
                  onChange={(e) => handleInputChange("simboloValuta", e.target.value)}
                  maxLength={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Posizione Valuta</label>
                <select
                  value={impostazioni.posizioneValuta}
                  onChange={(e) => handleInputChange("posizioneValuta", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="prefix">Prima del numero</option>
                  <option value="suffix">Dopo il numero</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Separatore Decimale</label>
                <select
                  value={impostazioni.separatoreDecimale}
                  onChange={(e) => handleInputChange("separatoreDecimale", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value=",">Virgola (,)</option>
                  <option value=".">Punto (.)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer e Social */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("footer")}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Share2 className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold">Footer e Social</h3>
          </div>
          {expandedSections.has("footer") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.has("footer") && (
          <div className="p-4 border-t border-border space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraBarcode}
                  onChange={(e) => handleInputChange("mostraBarcode", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra Barcode</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraQRCode}
                  onChange={(e) => handleInputChange("mostraQRCode", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra QR Code</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={impostazioni.mostraSocial}
                  onChange={(e) => handleInputChange("mostraSocial", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Mostra Social</span>
              </label>
            </div>
            
            {impostazioni.mostraQRCode && (
              <div>
                <label className="block text-sm font-medium mb-2">URL QR Code</label>
                <input
                  type="text"
                  value={impostazioni.urlQRCode || ""}
                  onChange={(e) => handleInputChange("urlQRCode", e.target.value)}
                  placeholder="https://esempio.com/menu"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
            
            {impostazioni.mostraSocial && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Facebook</label>
                  <input
                    type="text"
                    value={impostazioni.socialFacebook || ""}
                    onChange={(e) => handleInputChange("socialFacebook", e.target.value)}
                    placeholder="@pagina"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Instagram</label>
                  <input
                    type="text"
                    value={impostazioni.socialInstagram || ""}
                    onChange={(e) => handleInputChange("socialInstagram", e.target.value)}
                    placeholder="@profilo"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Impostazioni Stampante */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("stampante")}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Printer className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold">Impostazioni Stampante</h3>
          </div>
          {expandedSections.has("stampante") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {expandedSections.has("stampante") && (
          <div className="p-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Numero Copie</label>
                <input
                  type="number"
                  value={impostazioni.numeroCopieScontrino}
                  onChange={(e) => handleInputChange("numeroCopieScontrino", parseInt(e.target.value))}
                  min="1"
                  max="5"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Densità Stampa</label>
                <select
                  value={impostazioni.densitaStampa}
                  onChange={(e) => handleInputChange("densitaStampa", parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={1}>Bassa</option>
                  <option value={2}>Media</option>
                  <option value={3}>Alta</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Ritardo Taglio (ms)</label>
                <input
                  type="number"
                  value={impostazioni.ritardoTaglio}
                  onChange={(e) => handleInputChange("ritardoTaglio", parseInt(e.target.value))}
                  min="0"
                  max="1000"
                  step="50"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={impostazioni.taglioAutomatico}
                onChange={(e) => handleInputChange("taglioAutomatico", e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Taglio automatico carta</span>
            </label>
          </div>
        )}
      </div>

      {/* Note informative */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Note importanti:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Le modifiche verranno applicate agli scontrini futuri</li>
              <li>Il logo deve essere un URL pubblicamente accessibile</li>
              <li>La larghezza carta standard per stampanti termiche è 48 o 32 caratteri</li>
              <li>Testare sempre le impostazioni con una stampa di prova</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}