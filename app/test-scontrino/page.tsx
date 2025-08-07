"use client";

import { useState, useEffect } from "react";
import { printerService } from "@/lib/bluetooth/printer-service";

export default function TestScontrinoPage() {
  const [settings, setSettings] = useState<any>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);

  // Cattura i log del printer service
  useEffect(() => {
    const unsubscribe = printerService.onDebugLog((log) => {
      setLogs(prev => [...prev, log]);
    });
    return unsubscribe;
  }, []);

  // Test 1: Chiama API direttamente
  const testAPI = async () => {
    try {
      setError("");
      const response = await fetch('/api/impostazioni-scontrino');
      const text = await response.text();
      console.log("Risposta raw:", text);
      
      try {
        const json = JSON.parse(text);
        setApiResponse(json);
        console.log("Risposta JSON:", json);
      } catch (e) {
        setError(`Errore parsing JSON: ${e}`);
        setApiResponse(text);
      }
    } catch (err) {
      setError(`Errore chiamata API: ${err}`);
      console.error(err);
    }
  };

  // Test 2: Usa printer service
  const testPrinterService = async () => {
    try {
      setError("");
      setLogs([]); // Pulisci log
      const loaded = await printerService.loadReceiptSettings();
      setSettings(loaded);
      console.log("Settings caricate da printer service:", loaded);
    } catch (err) {
      setError(`Errore printer service: ${err}`);
      console.error(err);
    }
  };

  // Test 3: Stampa test con dati mock
  const testPrint = async () => {
    try {
      setError("");
      setLogs([]); // Pulisci log
      
      // Prima connetti
      const connected = await printerService.connectPrinter();
      if (!connected) {
        setError("Non riesco a connettermi alla stampante");
        return;
      }

      // Poi stampa con dati di test
      const testData = {
        numero: "TEST-001",
        data: new Date().toISOString(),
        tavolo: "1",
        cameriere: "Test",
        righe: [
          { nome: "Caffè", quantita: 1, prezzo: 1.50, totale: 1.50 }
        ],
        totale: 1.50,
        pagamenti: [
          { metodo: "CONTANTI", importo: 1.50 }
        ]
      };

      const success = await printerService.printReceipt(testData);
      if (!success) {
        setError("Stampa fallita");
      }
    } catch (err) {
      setError(`Errore stampa: ${err}`);
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Impostazioni Scontrino</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Test API */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">1. Test API Diretta</h2>
          <button
            onClick={testAPI}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Chiama /api/impostazioni-scontrino
          </button>
          
          {apiResponse && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Test Printer Service */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">2. Test Printer Service</h2>
          <button
            onClick={testPrinterService}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Carica via PrinterService
          </button>
          
          {settings && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">Settings caricate:</h3>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(settings, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Test Stampa */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">3. Test Stampa Completa</h2>
          <button
            onClick={testPrint}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Test Stampa con Settings
          </button>
        </div>

        {/* Log Console */}
        {logs.length > 0 && (
          <div className="bg-black text-green-400 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">Log Console:</h2>
            <div className="font-mono text-xs space-y-1 max-h-96 overflow-auto">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}