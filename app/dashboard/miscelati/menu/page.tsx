'use client';

import { useState, useEffect } from 'react';
import { Plus, Menu, ChevronRight, Wine, Coffee, Beer } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { getProdottiMiscelati, addProdottoMiscelatoToMenu } from '@/lib/actions/prodotti-miscelati';

interface ProdottoMiscelato {
  id: string;
  prodottoId: number;
  nome: string;
  categoria: string;
  prezzoBase: number;
  descrizione: string;
  attivo: boolean;
}

interface CategoriaMenu {
  id: number;
  nome: string;
  icon?: string;
}

export default function MiscelatiMenuPage() {
  const [prodotti, setProdotti] = useState<ProdottoMiscelato[]>([]);
  const [categorieMenu, setCategorieMenu] = useState<CategoriaMenu[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProdotto, setSelectedProdotto] = useState<ProdottoMiscelato | null>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Carica prodotti miscelati
    const result = await getProdottiMiscelati();
    if (result.success && result.data) {
      // Filtra solo prodotti attivi
      setProdotti(result.data.filter((p: ProdottoMiscelato) => p.attivo));
    }

    // Mock categorie menu - in produzione verranno dal database
    setCategorieMenu([
      { id: 1, nome: 'Cocktails', icon: 'cocktail' },
      { id: 2, nome: 'Long Drinks', icon: 'drink' },
      { id: 3, nome: 'Vini', icon: 'wine' },
      { id: 4, nome: 'Bevande', icon: 'beverage' }
    ]);
  };

  const handleAddToMenu = async () => {
    if (!selectedProdotto || !selectedCategoria) {
      alert('Seleziona un prodotto e una categoria');
      return;
    }

    setLoading(true);
    const result = await addProdottoMiscelatoToMenu(
      selectedProdotto.prodottoId,
      selectedCategoria
    );

    if (result.success) {
      alert('Prodotto aggiunto al menu con successo!');
      setShowModal(false);
      setSelectedProdotto(null);
      setSelectedCategoria('');
    } else {
      alert(result.error || 'Errore durante l\'aggiunta al menu');
    }
    setLoading(false);
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria) {
      case 'COCKTAIL':
        return <Wine className="h-5 w-5" />;
      case 'LONGDRINK':
        return <Beer className="h-5 w-5" />;
      default:
        return <Coffee className="h-5 w-5" />;
    }
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER", "SUPERVISORE"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Aggiungi al Menu
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Aggiungi i prodotti miscelati al menu del bar
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/miscelati/prodotti">
                <Button variant="outline" size="sm">
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Gestisci Prodotti
                </Button>
              </Link>
              <Link href="/dashboard/menu-builder">
                <Button variant="outline" size="sm">
                  <Menu className="mr-2 h-4 w-4" />
                  Menu Builder
                </Button>
              </Link>
            </div>
          </div>

          {/* Lista Prodotti */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prodotti.map(prodotto => (
              <Card key={prodotto.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(prodotto.categoria)}
                      <CardTitle className="text-lg">{prodotto.nome}</CardTitle>
                    </div>
                    <span className="text-lg font-bold">€{prodotto.prezzoBase.toFixed(2)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {prodotto.descrizione}
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedProdotto(prodotto);
                      setShowModal(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi al Menu
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {prodotti.length === 0 && (
            <div className="text-center py-12">
              <Wine className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nessun prodotto miscelato attivo</p>
              <Link href="/dashboard/miscelati/prodotti">
                <Button className="mt-4">
                  Crea Prodotti Miscelati
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Modal Selezione Categoria */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Aggiungi "{selectedProdotto?.nome}" al Menu
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="categoria">Categoria Menu</Label>
                <Select 
                  value={selectedCategoria} 
                  onValueChange={setSelectedCategoria}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorieMenu.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Il prodotto verrà aggiunto alla categoria selezionata e sarà 
                  immediatamente disponibile per gli ordini.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowModal(false);
                  setSelectedProdotto(null);
                  setSelectedCategoria('');
                }}
              >
                Annulla
              </Button>
              <Button 
                onClick={handleAddToMenu}
                disabled={!selectedCategoria || loading}
              >
                {loading ? 'Aggiunta in corso...' : 'Aggiungi al Menu'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}