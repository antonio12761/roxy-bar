'use client';

import { useState } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateExcelTemplate, importProductsFromExcel, exportProductsToExcel } from '@/lib/actions/import-export-products';

export default function ImportExportPage() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const result = await generateExcelTemplate();
      if (result.success && result.data) {
        // Decodifica base64 e crea blob
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'template_prodotti.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Errore nel download del template');
      }
    } catch (error) {
      setError('Errore durante il download del template');
      console.error(error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Per favore seleziona un file Excel (.xlsx o .xls)');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResults(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = await importProductsFromExcel(Buffer.from(buffer));
      
      if (result.success) {
        setImportResults(result.results);
      } else {
        setError(result.error || 'Errore durante l\'importazione');
      }
    } catch (error) {
      setError('Errore durante l\'elaborazione del file');
      console.error(error);
    } finally {
      setImporting(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const result = await exportProductsToExcel();
      if (result.success && result.data) {
        // Decodifica base64 e crea blob
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'export_prodotti.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Errore nell\'esportazione');
      }
    } catch (error) {
      setError('Errore durante l\'esportazione');
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER", "SUPERVISORE"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Importa/Esporta Prodotti
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Gestisci il tuo catalogo prodotti tramite file Excel
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Download Template */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Template Excel
                </CardTitle>
                <CardDescription>
                  Scarica il template Excel con tutti i campi disponibili
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Il template include:
                </p>
                <ul className="text-sm space-y-1 mb-4">
                  <li>• Informazioni base prodotto</li>
                  <li>• Gestione prezzi e disponibilità</li>
                  <li>• Allergeni e valori nutrizionali</li>
                  <li>• Configurazione prodotti miscelati</li>
                  <li>• Gruppi ingredienti con varianti</li>
                  <li>• Gestione inventario e fornitori</li>
                </ul>
                <Button 
                  onClick={handleDownloadTemplate}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Scarica Template
                </Button>
              </CardContent>
            </Card>

            {/* Import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importa Prodotti
                </CardTitle>
                <CardDescription>
                  Carica un file Excel per importare i prodotti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Usa il template scaricato per evitare errori di formattazione
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={importing}
                    className="hidden"
                    id="file-upload"
                  />
                  <label 
                    htmlFor="file-upload"
                    className="w-full"
                  >
                    <div 
                      className={`w-full cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 ${importing ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {importing ? 'Importazione in corso...' : 'Seleziona File Excel'}
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Esporta Catalogo Attuale
              </CardTitle>
              <CardDescription>
                Scarica tutti i prodotti attualmente nel database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                L\'export includerà tutti i prodotti con le loro configurazioni complete,
                inclusi i prodotti miscelati con i loro gruppi di ingredienti.
              </p>
              <Button 
                onClick={handleExport}
                disabled={exporting}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? 'Esportazione in corso...' : 'Esporta Tutti i Prodotti'}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {importResults && (
            <Alert className={importResults.failed > 0 ? 'border-yellow-500' : 'border-green-500'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Importazione completata!</p>
                  <p>✅ Prodotti importati con successo: {importResults.success}</p>
                  {importResults.failed > 0 && (
                    <p>⚠️ Prodotti non importati: {importResults.failed}</p>
                  )}
                  {importResults.errors && importResults.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Errori:</p>
                      <ul className="text-sm mt-1 space-y-1">
                        {importResults.errors.map((err: string, i: number) => (
                          <li key={i} className="text-red-600 dark:text-red-400">
                            • {err}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Istruzioni per l\'Importazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold mb-2">1. Preparazione del File</h3>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Scarica il template Excel</li>
                    <li>• Compila i campi obbligatori (contrassegnati con *)</li>
                    <li>• Usa i valori consentiti per categorie e postazioni</li>
                    <li>• Per i decimali usa il punto (es. 8.50)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">2. Prodotti Miscelati</h3>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Imposta "eMiscelato" = SI per prodotti configurabili</li>
                    <li>• Definisci fino a 5 gruppi di ingredienti</li>
                    <li>• Specifica ingredienti e prezzi extra per ogni gruppo</li>
                    <li>• Usa virgole per separare liste di valori</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">3. Campi Speciali</h3>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Allergeni: lista separata da virgole</li>
                    <li>• Orari: formato "HH:MM-HH:MM,HH:MM-HH:MM"</li>
                    <li>• Giorni: LUN,MAR,MER,GIO,VEN,SAB,DOM</li>
                    <li>• Valori nutrizionali in grammi o kcal</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">4. Controllo Errori</h3>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Verifica che tutti i campi obbligatori siano compilati</li>
                    <li>• Controlla che i prezzi siano numeri validi</li>
                    <li>• Assicurati che le categorie siano corrette</li>
                    <li>• Rimuovi la riga degli esempi prima dell\'importazione</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}