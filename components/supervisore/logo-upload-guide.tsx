"use client";

import { useState } from "react";
import { HelpCircle, X, ExternalLink, Copy, Check } from "lucide-react";

export default function LogoUploadGuide() {
  const [showGuide, setShowGuide] = useState(false);
  const [copiedText, setCopiedText] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(""), 2000);
  };

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
      >
        <HelpCircle className="h-3 w-3" />
        Come caricare il logo?
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Guida Caricamento Logo</h2>
                <button
                  onClick={() => setShowGuide(false)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Opzione 1: Imgur */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-green-400 mb-2">
                    Opzione 1: Imgur (Consigliato - Gratuito)
                  </h3>
                  <ol className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">1.</span>
                      <div>
                        Vai su{" "}
                        <a
                          href="https://imgur.com/upload"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:underline inline-flex items-center gap-1"
                        >
                          imgur.com/upload
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">2.</span>
                      <span>Clicca "New post" e carica il tuo logo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">3.</span>
                      <span>Dopo il caricamento, fai clic destro sull'immagine</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">4.</span>
                      <span>Seleziona "Copia indirizzo immagine"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">5.</span>
                      <span>L'URL sarà tipo: https://i.imgur.com/XXXXXX.png</span>
                    </li>
                  </ol>
                </div>

                {/* Opzione 2: ImgBB */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-blue-400 mb-2">
                    Opzione 2: ImgBB (Gratuito)
                  </h3>
                  <ol className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">1.</span>
                      <div>
                        Vai su{" "}
                        <a
                          href="https://imgbb.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:underline inline-flex items-center gap-1"
                        >
                          imgbb.com
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">2.</span>
                      <span>Clicca "Start uploading"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">3.</span>
                      <span>Carica il logo e clicca "Upload"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">4.</span>
                      <span>Copia il "Direct link" fornito</span>
                    </li>
                  </ol>
                </div>

                {/* Suggerimenti */}
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-400 mb-2">
                    Suggerimenti per il Logo
                  </h3>
                  <ul className="space-y-1 text-sm text-blue-200">
                    <li>• Usa immagini PNG con sfondo trasparente</li>
                    <li>• Dimensione consigliata: 200x80 pixel</li>
                    <li>• Il logo verrà convertito in bianco e nero per la stampa</li>
                    <li>• Evita dettagli troppo piccoli che potrebbero non stampare bene</li>
                  </ul>
                </div>

                {/* Problema Google Drive */}
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <h3 className="font-semibold text-red-400 mb-2">
                    Perché Google Drive non funziona?
                  </h3>
                  <p className="text-sm text-red-200">
                    Google Drive ha restrizioni CORS (Cross-Origin Resource Sharing) che
                    impediscono il caricamento diretto delle immagini in applicazioni web.
                    Per questo motivo, consigliamo di usare servizi di hosting immagini
                    dedicati come Imgur o ImgBB.
                  </p>
                </div>

                {/* Test URL */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Test URL Immagine</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Puoi testare se un URL funziona incollandolo qui:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://i.imgur.com/esempio.png"
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      id="test-url"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('test-url') as HTMLInputElement;
                        if (input?.value) {
                          window.open(input.value, '_blank');
                        }
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                    >
                      Testa
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowGuide(false)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Chiudi Guida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}