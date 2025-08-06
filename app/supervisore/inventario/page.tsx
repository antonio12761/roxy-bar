"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Package, AlertCircle, RefreshCw, Save } from "lucide-react";
import { updateProductAvailability } from "@/lib/actions/inventory-management";
// import { getCurrentUser } from "@/lib/auth-multi-tenant";

interface ProdottoInventario {
  id: number;
  nome: string;
  categoria: string;
  quantitaDisponibile: number;
  terminato: boolean;
  ultimoAggiornamento?: Date;
}

export default function InventarioPage() {
  const [prodotti, setProdotti] = useState<ProdottoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
    loadInventario();
  }, []);

  const loadUser = async () => {
    // const user = await getCurrentUser();
    // setCurrentUser(user);
    setCurrentUser(null);
  };

  const loadInventario = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/inventario");
      const data = await response.json();
      setProdotti(data.prodotti || []);
      
      // Inizializza le quantità
      const initialQuantities: Record<number, number> = {};
      data.prodotti?.forEach((p: ProdottoInventario) => {
        initialQuantities[p.id] = p.quantitaDisponibile;
      });
      setQuantities(initialQuantities);
    } catch (error) {
      console.error("Errore caricamento inventario:", error);
      toast.error("Impossibile caricare l'inventario");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (prodottoId: number, nome: string) => {
    if (!currentUser) {
      toast.error("Utente non autenticato");
      return;
    }

    try {
      const result = await updateProductAvailability(
        prodottoId,
        quantities[prodottoId],
        currentUser.id,
        currentUser.nome || currentUser.username,
        "Aggiornamento manuale da supervisore"
      );

      if (result.success) {
        toast.success(`Quantità di ${nome} aggiornata con successo`);
        setEditingProduct(null);
        loadInventario();
      } else {
        toast.error(result.error || "Impossibile aggiornare la quantità");
      }
    } catch (error) {
      toast.error("Errore durante l'aggiornamento");
    }
  };

  const filteredProdotti = prodotti.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const prodottiEsauriti = filteredProdotti.filter(p => p.quantitaDisponibile === 0);
  const prodottiDisponibili = filteredProdotti.filter(p => p.quantitaDisponibile > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Gestione Inventario
        </h1>
        <Button onClick={loadInventario} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Cerca prodotto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {prodottiEsauriti.length > 0 && (
        <Card className="border-red-500">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Prodotti Esauriti ({prodottiEsauriti.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {prodottiEsauriti.map((prodotto) => (
                <div key={prodotto.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{prodotto.nome}</p>
                    <p className="text-sm text-gray-500">{prodotto.categoria}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingProduct === prodotto.id ? (
                      <>
                        <Input
                          type="number"
                          min="0"
                          value={quantities[prodotto.id]}
                          onChange={(e) => setQuantities({
                            ...quantities,
                            [prodotto.id]: parseInt(e.target.value) || 0
                          })}
                          className="w-20"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdateQuantity(prodotto.id, prodotto.nome)}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProduct(null);
                            setQuantities({
                              ...quantities,
                              [prodotto.id]: prodotto.quantitaDisponibile
                            });
                          }}
                        >
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-red-600 font-bold">ESAURITO</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingProduct(prodotto.id)}
                        >
                          Modifica
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prodotti Disponibili ({prodottiDisponibili.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {prodottiDisponibili.map((prodotto) => (
              <div key={prodotto.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{prodotto.nome}</p>
                  <p className="text-sm text-gray-500">{prodotto.categoria}</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingProduct === prodotto.id ? (
                    <>
                      <Input
                        type="number"
                        min="0"
                        value={quantities[prodotto.id]}
                        onChange={(e) => setQuantities({
                          ...quantities,
                          [prodotto.id]: parseInt(e.target.value) || 0
                        })}
                        className="w-20"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateQuantity(prodotto.id, prodotto.nome)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingProduct(null);
                          setQuantities({
                            ...quantities,
                            [prodotto.id]: prodotto.quantitaDisponibile
                          });
                        }}
                      >
                        Annulla
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-green-600">
                        {prodotto.quantitaDisponibile} disponibili
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingProduct(prodotto.id)}
                      >
                        Modifica
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}