"use client";

import { useState, useEffect } from "react";
import { getTavoli } from "@/lib/actions/ordinazioni";

export default function TestPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTables() {
      try {
        console.log("Test: Caricamento tavoli...");
        const data = await getTavoli();
        console.log("Test: Tavoli ricevuti:", data);
        setTables(data || []);
      } catch (err) {
        console.error("Test: Errore:", err);
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
      } finally {
        setLoading(false);
      }
    }
    
    loadTables();
  }, []);

  if (loading) return <div>Caricamento...</div>;
  if (error) return <div>Errore: {error}</div>;

  return (
    <div className="p-4">
      <h1>Test Tavoli</h1>
      <p>Tavoli trovati: {tables.length}</p>
      <pre>{JSON.stringify(tables, null, 2)}</pre>
    </div>
  );
}