"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, X, Plus, Trash2, Download, Upload } from "lucide-react";
import { getProducts, updateProduct, deleteProduct, createProduct } from "@/lib/actions/products";
import { AuthGuard } from "@/components/auth-guard";

interface Product {
  id: number;
  nome: string;
  prezzo: number | any; // Gestisce Decimal di Prisma
  categoria: string;
  disponibile: boolean;
  unitaMisura: string;
  postazione?: string | null;
}

export default function ProductsSpreadsheetPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ id: number; field: keyof Product } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");
  const [newRow, setNewRow] = useState<Partial<Product>>({
    nome: "",
    prezzo: 0,
    categoria: "",
    disponibile: true,
    unitaMisura: "pz",
    postazione: "BANCO"
  });
  const [showNewRow, setShowNewRow] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      // Assicurati che i dati siano validi
      const validProducts = data.map((p: any) => ({
        ...p,
        prezzo: p.prezzo || 0,
        unitaMisura: p.unitaMisura || 'pz',
        postazione: p.postazione || 'BANCO'
      }));
      setProducts(validProducts);
    } catch (error) {
      console.error("Errore caricamento prodotti:", error);
      alert("Errore nel caricamento dei prodotti");
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (id: number, field: keyof Product, value: any) => {
    setEditingCell({ id, field });
    setTempValue(String(value));
  };

  const handleCellChange = (value: string) => {
    setTempValue(value);
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    const product = products.find(p => p.id === editingCell.id);
    if (!product) return;

    let updatedValue: any = tempValue;
    
    // Conversione tipi
    if (editingCell.field === 'prezzo') {
      updatedValue = parseFloat(tempValue) || 0;
    } else if (editingCell.field === 'disponibile') {
      updatedValue = tempValue.toLowerCase() === 'true' || tempValue === '1' || tempValue.toLowerCase() === 'si';
    }

    try {
      await updateProduct(editingCell.id, { [editingCell.field]: updatedValue });
      setProducts(products.map(p => 
        p.id === editingCell.id 
          ? { ...p, [editingCell.field]: updatedValue }
          : p
      ));
      setEditingCell(null);
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      alert("Errore durante l'aggiornamento del prodotto");
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setTempValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Eliminare questo prodotto?")) return;

    try {
      await deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error("Errore eliminazione:", error);
    }
  };

  const handleAddProduct = async () => {
    if (!newRow.nome || !newRow.prezzo) {
      alert("Nome e prezzo sono obbligatori");
      return;
    }

    try {
      const created = await createProduct({
        name: newRow.nome,
        price: newRow.prezzo,
        available: newRow.disponibile ?? true
      });
      
      await loadProducts();
      setNewRow({
        nome: "",
        prezzo: 0,
        categoria: "",
        disponibile: true,
        unitaMisura: "pz",
        postazione: "BANCO"
      });
      setShowNewRow(false);
    } catch (error) {
      console.error("Errore creazione prodotto:", error);
    }
  };

  const exportToCSV = () => {
    const headers = ["ID", "Nome", "Prezzo", "Categoria", "Disponibile", "Unità", "Postazione"];
    const rows = products.map(p => [
      p.id,
      p.nome,
      p.prezzo,
      p.categoria,
      p.disponibile ? "SI" : "NO",
      p.unitaMisura,
      p.postazione || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `prodotti_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Caricamento...</div>
      </div>
    );
  }

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <ArrowLeft className="h-6 w-6 text-white/70" />
              </Link>
              <h1 className="text-2xl font-bold text-white">Prodotti - Vista Foglio di Calcolo</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewRow(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nuovo
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="h-4 w-4" />
                Esporta CSV
              </button>
            </div>
          </div>
        </div>

        {/* Tabella */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-700">
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">ID</th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">Nome</th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">Prezzo €</th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">Categoria</th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">Disponibile</th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">Unità</th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-white font-medium">Postazione</th>
                  <th className="border border-slate-600 px-4 py-2 text-center text-white font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {/* Riga nuovo prodotto */}
                {showNewRow && (
                  <tr className="bg-green-900/20">
                    <td className="border border-slate-600 px-4 py-2 text-white">NEW</td>
                    <td className="border border-slate-600 px-2 py-1">
                      <input
                        type="text"
                        value={newRow.nome}
                        onChange={(e) => setNewRow({ ...newRow, nome: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-green-500"
                        placeholder="Nome prodotto"
                      />
                    </td>
                    <td className="border border-slate-600 px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={newRow.prezzo}
                        onChange={(e) => setNewRow({ ...newRow, prezzo: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-green-500"
                      />
                    </td>
                    <td className="border border-slate-600 px-2 py-1">
                      <input
                        type="text"
                        value={newRow.categoria}
                        onChange={(e) => setNewRow({ ...newRow, categoria: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-green-500"
                        placeholder="Categoria"
                      />
                    </td>
                    <td className="border border-slate-600 px-2 py-1">
                      <select
                        value={newRow.disponibile ? "true" : "false"}
                        onChange={(e) => setNewRow({ ...newRow, disponibile: e.target.value === "true" })}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-green-500"
                      >
                        <option value="true">SI</option>
                        <option value="false">NO</option>
                      </select>
                    </td>
                    <td className="border border-slate-600 px-2 py-1">
                      <input
                        type="text"
                        value={newRow.unitaMisura}
                        onChange={(e) => setNewRow({ ...newRow, unitaMisura: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-green-500"
                      />
                    </td>
                    <td className="border border-slate-600 px-2 py-1">
                      <select
                        value={newRow.postazione || "BANCO"}
                        onChange={(e) => setNewRow({ ...newRow, postazione: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-green-500"
                      >
                        <option value="BANCO">BANCO</option>
                        <option value="CUCINA">CUCINA</option>
                        <option value="BAR">BAR</option>
                      </select>
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={handleAddProduct}
                          className="p-1 text-green-400 hover:text-green-300"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowNewRow(false)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Righe prodotti */}
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-700/50">
                    <td className="border border-slate-600 px-4 py-2 text-white font-mono">{product.id}</td>
                    
                    {/* Nome */}
                    <td className="border border-slate-600 px-2 py-1">
                      {editingCell?.id === product.id && editingCell.field === 'nome' ? (
                        <input
                          type="text"
                          value={tempValue}
                          onChange={(e) => handleCellChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleCellSave}
                          className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-amber-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => handleCellClick(product.id, 'nome', product.nome)}
                          className="px-2 py-1 text-white cursor-pointer hover:bg-slate-700 rounded"
                        >
                          {product.nome}
                        </div>
                      )}
                    </td>

                    {/* Prezzo */}
                    <td className="border border-slate-600 px-2 py-1">
                      {editingCell?.id === product.id && editingCell.field === 'prezzo' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={tempValue}
                          onChange={(e) => handleCellChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleCellSave}
                          className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-amber-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => handleCellClick(product.id, 'prezzo', product.prezzo)}
                          className="px-2 py-1 text-white cursor-pointer hover:bg-slate-700 rounded"
                        >
                          {product.prezzo ? Number(product.prezzo).toFixed(2) : '0.00'}
                        </div>
                      )}
                    </td>

                    {/* Categoria */}
                    <td className="border border-slate-600 px-2 py-1">
                      {editingCell?.id === product.id && editingCell.field === 'categoria' ? (
                        <input
                          type="text"
                          value={tempValue}
                          onChange={(e) => handleCellChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleCellSave}
                          className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-amber-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => handleCellClick(product.id, 'categoria', product.categoria)}
                          className="px-2 py-1 text-white cursor-pointer hover:bg-slate-700 rounded"
                        >
                          {product.categoria}
                        </div>
                      )}
                    </td>

                    {/* Disponibile */}
                    <td className="border border-slate-600 px-2 py-1">
                      <div
                        onClick={() => handleCellClick(product.id, 'disponibile', product.disponibile)}
                        className={`px-2 py-1 text-center cursor-pointer hover:bg-slate-700 rounded ${
                          product.disponibile ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {product.disponibile ? 'SI' : 'NO'}
                      </div>
                    </td>

                    {/* Unità Misura */}
                    <td className="border border-slate-600 px-2 py-1">
                      {editingCell?.id === product.id && editingCell.field === 'unitaMisura' ? (
                        <input
                          type="text"
                          value={tempValue}
                          onChange={(e) => handleCellChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleCellSave}
                          className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-amber-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => handleCellClick(product.id, 'unitaMisura', product.unitaMisura)}
                          className="px-2 py-1 text-white cursor-pointer hover:bg-slate-700 rounded"
                        >
                          {product.unitaMisura}
                        </div>
                      )}
                    </td>

                    {/* Postazione */}
                    <td className="border border-slate-600 px-2 py-1">
                      <div className="px-2 py-1 text-white">
                        {product.postazione || '-'}
                      </div>
                    </td>

                    {/* Azioni */}
                    <td className="border border-slate-600 px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Istruzioni */}
        <div className="mt-4 bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">
            <strong>Istruzioni:</strong> Clicca su una cella per modificarla. Premi Invio per salvare o Esc per annullare.
          </p>
        </div>
      </div>
    </AuthGuard>
  );
}