"use client";

import { useState, useEffect } from "react";

export default function TestAdminScontrinoPage() {
  const [impostazioni, setImpostazioni] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Carica impostazioni
  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/impostazioni-scontrino");
      const data = await response.json();
      if (data.success) {
        setImpostazioni(data.data);
        setMessage("✅ Impostazioni caricate");
      } else {
        setMessage("❌ Errore caricamento");
      }
    } catch (error) {
      setMessage(`❌ Errore: ${error}`);
    }
    setLoading(false);
  };

  // Salva impostazioni
  const saveSettings = async () => {
    if (!impostazioni) return;
    
    setLoading(true);
    try {
      const method = impostazioni.id ? "PUT" : "POST";
      const response = await fetch("/api/impostazioni-scontrino", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(impostazioni)
      });
      
      const data = await response.json();
      if (data.success) {
        setImpostazioni(data.data);
        setMessage("✅ Salvato con successo!");
      } else {
        setMessage(`❌ Errore: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Errore salvataggio: ${error}`);
    }
    setLoading(false);
  };

  // Aggiorna campo
  const updateField = (field: string, value: any) => {
    setImpostazioni((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (!impostazioni) {
    return <div className="p-8">Caricamento...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Test Admin Scontrino</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.includes("✅") ? "bg-green-800" : "bg-red-800"}`}>
          {message}
        </div>
      )}

      <div className="space-y-4 bg-gray-800 p-6 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">ID (non modificare)</label>
          <input
            type="text"
            value={impostazioni.id || ""}
            disabled
            className="w-full p-2 bg-gray-700 rounded text-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nome Attività</label>
          <input
            type="text"
            value={impostazioni.nomeAttivita || ""}
            onChange={(e) => updateField("nomeAttivita", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Indirizzo</label>
          <input
            type="text"
            value={impostazioni.indirizzo || ""}
            onChange={(e) => updateField("indirizzo", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Telefono</label>
          <input
            type="text"
            value={impostazioni.telefono || ""}
            onChange={(e) => updateField("telefono", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">P.IVA</label>
          <input
            type="text"
            value={impostazioni.partitaIva || ""}
            onChange={(e) => updateField("partitaIva", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Messaggio Intestazione</label>
          <input
            type="text"
            value={impostazioni.messaggioIntestazione || ""}
            onChange={(e) => updateField("messaggioIntestazione", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Messaggio Ringraziamento</label>
          <input
            type="text"
            value={impostazioni.messaggioRingraziamento || ""}
            onChange={(e) => updateField("messaggioRingraziamento", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Instagram</label>
          <input
            type="text"
            value={impostazioni.socialInstagram || ""}
            onChange={(e) => updateField("socialInstagram", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sito Web (footer)</label>
          <input
            type="text"
            value={impostazioni.messaggioPiePagina || ""}
            onChange={(e) => updateField("messaggioPiePagina", e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={impostazioni.mostraSocial || false}
            onChange={(e) => updateField("mostraSocial", e.target.checked)}
            className="w-4 h-4"
          />
          <label>Mostra Social</label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={impostazioni.taglioAutomatico || false}
            onChange={(e) => updateField("taglioAutomatico", e.target.checked)}
            className="w-4 h-4"
          />
          <label>Taglio Automatico</label>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={saveSettings}
          disabled={loading}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold disabled:opacity-50"
        >
          {loading ? "Salvataggio..." : "💾 SALVA IMPOSTAZIONI"}
        </button>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold disabled:opacity-50"
        >
          🔄 Ricarica
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-800 rounded">
        <h3 className="font-bold mb-2">Debug - Dati completi:</h3>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(impostazioni, null, 2)}
        </pre>
      </div>
    </div>
  );
}