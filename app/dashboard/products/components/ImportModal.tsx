"use client";

import { useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { importProductsFromCSV, generateCSVTemplate, generateSimpleTemplate } from "@/lib/actions/import-products";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (validTypes.includes(file.type) || file.name.endsWith('.csv')) {
        setImportFile(file);
        setImportResults(null);
      } else {
        alert('Tipo di file non supportato. Usa CSV o Excel.');
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResults(null);

    try {
      const text = await importFile.text();
      const result = await importProductsFromCSV(text);
      
      setImportResults(result);
      
      if (result.success) {
        onSuccess();
        if (result.errors.length === 0) {
          alert(`✅ Importazione completata! ${result.created} creati, ${result.updated} aggiornati.`);
        }
      }
    } catch (error) {
      alert('❌ Errore durante l\'importazione del file');
      console.error('Errore importazione:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = async (simple = false) => {
    try {
      const csvContent = simple ? await generateSimpleTemplate() : await generateCSVTemplate();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = simple ? 'elenco-prodotti-semplice.txt' : 'template-prodotti.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('❌ Errore durante il download del template');
    }  
  };

  const handleClose = () => {
    setImportFile(null);
    setImportResults(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleClose}
    >
      <div 
        className="rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
            Importa Prodotti da CSV/Excel
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.text.secondary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="rounded-lg p-4" style={{ 
            backgroundColor: colors.bg.darker,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <h4 className="font-semibold mb-2" style={{ color: colors.text.primary }}>
              1. Scarica un Template
            </h4>
            <p className="text-sm mb-3" style={{ color: colors.text.secondary }}>
              Scegli il tipo di template che preferisci usare:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => downloadTemplate(true)}
                className="w-full px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
                style={{ 
                  backgroundColor: colors.button.success, 
                  color: colors.button.successText 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
              >
                <Download className="h-4 w-4" />
                📝 Elenco Semplice (solo nomi prodotti)
              </button>
              <button
                onClick={() => downloadTemplate(false)}
                className="w-full px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
                style={{ 
                  backgroundColor: colors.button.primary, 
                  color: colors.button.primaryText 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
              >
                <Download className="h-4 w-4" />
                📊 Template Completo (con prezzi e categorie)
              </button>
            </div>
            <div className="mt-2 text-xs" style={{ color: colors.text.muted }}>
              💡 <strong>Suggerimento:</strong> Usa l'elenco semplice se hai solo i nomi dei prodotti. 
              Potrai aggiungere prezzi e categorie successivamente modificando ogni prodotto.
            </div>
          </div>

          {/* File Upload */}
          <div className="rounded-lg p-4" style={{ 
            backgroundColor: colors.bg.darker,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <h4 className="font-semibold mb-2" style={{ color: colors.text.primary }}>
              2. Carica il tuo File
            </h4>
            <p className="text-sm mb-3" style={{ color: colors.text.secondary }}>
              Seleziona il file CSV o Excel con i prodotti da importare.
            </p>
            <div className="space-y-3">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: colors.bg.input, 
                  borderColor: colors.border.primary, 
                  color: colors.text.primary,
                  borderWidth: '1px', 
                  borderStyle: 'solid' 
                }}
              />
              {importFile && (
                <div className="text-sm" style={{ color: colors.text.success }}>
                  ✅ File selezionato: {importFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Import Button */}
          {importFile && (
            <div className="rounded-lg p-4" style={{ 
              backgroundColor: colors.bg.darker,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <h4 className="font-semibold mb-2" style={{ color: colors.text.primary }}>
                3. Avvia Importazione
              </h4>
              <p className="text-sm mb-3" style={{ color: colors.text.secondary }}>
                Clicca per iniziare l'importazione. I prodotti esistenti saranno aggiornati.
              </p>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 disabled:opacity-50"
                style={{ 
                  backgroundColor: colors.button.primary, 
                  color: colors.button.primaryText 
                }}
                onMouseEnter={(e) => !isImporting && (e.currentTarget.style.backgroundColor = colors.button.primaryHover)}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Avvia Importazione
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results */}
          {importResults && (
            <div className="rounded-lg p-4" style={{ 
              backgroundColor: importResults.success ? colors.bg.darker : colors.bg.darker,
              borderColor: importResults.success ? colors.border.success : colors.border.error,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <h4 className="font-semibold mb-2" style={{ 
                color: importResults.success ? colors.text.success : colors.text.error 
              }}>
                Risultati Importazione
              </h4>
              
              <div className="space-y-2 text-sm">
                <div style={{ color: importResults.success ? colors.text.primary : colors.text.error }}>
                  📊 Righe elaborate: {importResults.processed}
                </div>
                {importResults.success && (
                  <>
                    <div style={{ color: colors.text.success }}>
                      ✅ Prodotti creati: {importResults.created}
                    </div>
                    <div style={{ color: colors.text.success }}>
                      🔄 Prodotti aggiornati: {importResults.updated}
                    </div>
                  </>
                )}
                
                {importResults.errors && importResults.errors.length > 0 && (
                  <div className="mt-3">
                    <div className="font-medium mb-1" style={{ color: colors.text.error }}>
                      ⚠️ Errori:
                    </div>
                    <div className="rounded p-2 max-h-32 overflow-y-auto" style={{ 
                      backgroundColor: colors.bg.card,
                      borderColor: colors.border.error,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}>
                      {importResults.errors.map((error: string, index: number) => (
                        <div key={index} className="text-xs" style={{ color: colors.text.error }}>
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Format Info */}
          <div className="rounded-lg p-4" style={{ 
            backgroundColor: colors.bg.darker,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <h4 className="font-semibold mb-2" style={{ color: colors.text.primary }}>
              Formati Supportati
            </h4>
            <div className="text-sm space-y-3" style={{ color: colors.text.secondary }}>
              <div>
                <div className="font-semibold" style={{ color: colors.text.success }}>
                  📝 Elenco Semplice:
                </div>
                <p className="text-xs mb-1">Un nome prodotto per riga, senza header:</p>
                <div className="p-2 rounded text-xs font-mono" style={{ 
                  backgroundColor: colors.bg.card,
                  color: colors.text.primary
                }}>
                  Caffè Espresso<br/>
                  Cappuccino<br/>
                  Brioche alla marmellata
                </div>
              </div>
              
              <div>
                <div className="font-semibold" style={{ color: colors.button.primary }}>
                  📊 CSV Completo:
                </div>
                <p className="text-xs mb-1">Con header e colonne:</p>
                <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                  <li><code>name</code> - Nome prodotto (obbligatorio)</li>
                  <li><code>description</code> - Descrizione</li>
                  <li><code>price</code> - Prezzo (es: 12.50)</li>
                  <li><code>imageUrl</code> - URL immagine</li>
                  <li><code>categoryName</code> - Nome categoria</li>
                  <li><code>subcategoryName</code> - Nome sottocategoria</li>
                  <li><code>available</code> - Disponibile (true/false)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}