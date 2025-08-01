"use client";

import { useState, useEffect } from "react";
import { X, Search, Coffee, AlertCircle, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getAllProdotti } from "@/lib/actions/ordinazioni";
import { toggleProductAvailability } from "@/lib/actions/prodotti";
import { toast } from "@/lib/toast";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
  disponibile?: boolean;
  ingredienti?: string | null;
}

interface ProductsAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProductsAvailabilityModal({ isOpen, onClose }: ProductsAvailabilityModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingProducts, setUpdatingProducts] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const prodottiData = await getAllProdotti();
      console.log("Prodotti caricati:", prodottiData?.length || 0, "di cui non disponibili:", prodottiData?.filter(p => !p.disponibile).length || 0);
      setProducts(prodottiData || []);
    } catch (error) {
      console.error("Errore caricamento prodotti:", error);
      toast.error("Errore nel caricamento dei prodotti");
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.codice?.toString().includes(searchQuery)
      );
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(p => p.categoria === selectedCategory);
    }
    
    // Sort by availability (unavailable first) then by name
    filtered.sort((a, b) => {
      if (a.disponibile === b.disponibile) {
        return a.nome.localeCompare(b.nome);
      }
      return a.disponibile === false ? -1 : 1;
    });
    
    setFilteredProducts(filtered);
  };

  const handleToggleAvailability = async (product: Product) => {
    if (updatingProducts.has(product.id)) return;
    
    console.log(`[ProductsAvailability] Toggling availability for ${product.nome} (ID: ${product.id}) from ${product.disponibile} to ${!product.disponibile}`);
    setUpdatingProducts(prev => new Set(prev).add(product.id));
    
    try {
      const result = await toggleProductAvailability(product.id, !product.disponibile);
      console.log(`[ProductsAvailability] Toggle result:`, result);
      if (result.success) {
        // Update local state
        setProducts(prev => prev.map(p => 
          p.id === product.id ? { ...p, disponibile: !product.disponibile } : p
        ));
      } else {
        toast.error(result.error || "Errore nell'aggiornamento");
      }
    } catch (error) {
      console.error("Errore toggle disponibilità:", error);
      toast.error("Errore nell'aggiornamento della disponibilità");
    } finally {
      setUpdatingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria))).sort();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-4 flex items-center justify-between border-b"
          style={{ borderColor: colors.border.primary }}
        >
          <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
            Gestione Disponibilità Prodotti
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: 'transparent',
              color: colors.text.muted
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 space-y-3 border-b" style={{ borderColor: colors.border.primary }}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
            <input
              type="text"
              placeholder="Cerca prodotto per nome o codice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg"
              style={{
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.secondary,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: colors.text.primary
              }}
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                !selectedCategory ? 'ring-2' : ''
              }`}
              style={{
                backgroundColor: !selectedCategory ? colors.accent : colors.bg.hover,
                color: !selectedCategory ? 'white' : colors.text.secondary,
                ...(selectedCategory === null && { ringColor: colors.accent + '40' })
              }}
            >
              Tutte
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat ? 'ring-2' : ''
                }`}
                style={{
                  backgroundColor: selectedCategory === cat ? colors.accent : colors.bg.hover,
                  color: selectedCategory === cat ? 'white' : colors.text.secondary,
                  ...(selectedCategory === cat && { ringColor: colors.accent + '40' })
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.muted }} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
              <p style={{ color: colors.text.muted }}>
                {searchQuery ? 'Nessun prodotto trovato' : 'Nessun prodotto disponibile'}
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    product.disponibile === false ? 'opacity-75' : ''
                  }`}
                  style={{
                    backgroundColor: product.disponibile === false ? colors.button.danger + '10' : colors.bg.hover,
                    borderColor: product.disponibile === false ? colors.button.danger + '40' : colors.border.secondary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                  onClick={() => handleToggleAvailability(product)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 
                          className={`font-medium ${product.disponibile === false ? 'line-through' : ''}`}
                          style={{ color: colors.text.primary }}
                        >
                          {product.nome}
                        </h3>
                        {product.codice && (
                          <span className="text-sm" style={{ color: colors.text.muted }}>
                            #{product.codice}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm mt-1">
                        <span style={{ color: colors.text.secondary }}>{product.categoria}</span>
                        <span style={{ color: colors.text.secondary }}>€{product.prezzo.toFixed(2)}</span>
                        {product.postazione && (
                          <span style={{ color: colors.text.muted }}>{product.postazione}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {updatingProducts.has(product.id) ? (
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: colors.text.muted }} />
                      ) : (
                        <AlertCircle 
                          className="h-5 w-5" 
                          style={{ 
                            color: product.disponibile === false ? colors.button.danger : colors.button.success 
                          }} 
                        />
                      )}
                      <span 
                        className="text-sm font-medium"
                        style={{ 
                          color: product.disponibile === false ? colors.button.danger : colors.button.success 
                        }}
                      >
                        {product.disponibile === false ? 'Esaurito' : 'Disponibile'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="p-4 border-t text-center text-sm"
          style={{ 
            borderColor: colors.border.primary,
            color: colors.text.muted
          }}
        >
          Clicca su un prodotto per cambiare la sua disponibilità
        </div>
      </div>
    </div>
  );
}