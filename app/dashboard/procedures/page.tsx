"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { 
  ChefHat, 
  Plus, 
  Search, 
  Edit2,
  Trash2,
  ArrowLeft,
  FileText,
  Package
} from "lucide-react";
import Link from "next/link";
import { 
  getProducts
} from "@/lib/actions/products";
import { AuthGuard } from "@/components/auth-guard";
import { useTheme } from "@/contexts/ThemeContext";
import { ProcedureModal } from "../products/components/ProcedureModal";

interface Product {
  id: number;
  name: string;
  description?: string;
  category?: { name: string };
  subcategory?: { name: string };
  ProductProcedure?: {
    id: string;
    ProcedureStep: Array<{
      id: string;
      order: number;
      description: string;
      ProcedureIngredient: Array<{
        id: string;
        name: string;
        quantity: number;
        unit: string;
      }>;
    }>;
  };
}

export default function ProceduresPage() {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "with" | "without">("all");
  
  // Modal state
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, filterType]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      // Load products with their procedures
      const productsData = await getProducts();
      
      // For each product, load its procedure
      const productsWithProcedures = await Promise.all(
        productsData.map(async (product: any) => {
          try {
            const response = await fetch(`/api/products/procedures?productId=${product.id}`);
            if (response.ok) {
              const procedure = await response.json();
              return { ...product, ProductProcedure: procedure };
            }
          } catch (error) {
            console.error(`Error loading procedure for product ${product.id}:`, error);
          }
          return product;
        })
      );
      
      setProducts(productsWithProcedures);
    } catch (error) {
      console.error("Errore caricamento prodotti:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Procedure filter
    if (filterType === "with") {
      filtered = filtered.filter(product => product.ProductProcedure);
    } else if (filterType === "without") {
      filtered = filtered.filter(product => !product.ProductProcedure);
    }

    setFilteredProducts(filtered);
  };

  const openProcedureModal = (product: Product) => {
    setSelectedProduct(product);
    setShowProcedureModal(true);
  };

  const deleteProcedure = async (productId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questa procedura?")) return;

    try {
      const response = await fetch(`/api/products/procedures?productId=${productId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        await loadProducts();
        alert("✅ Procedura eliminata con successo!");
      } else {
        alert("❌ Errore nell'eliminazione della procedura");
      }
    } catch (error) {
      console.error("Errore:", error);
      alert("❌ Errore nell'eliminazione della procedura");
    }
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen p-6" style={{ backgroundColor: colors.bg.main }}>
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/dashboard" 
              className="p-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: colors.bg.card,
                color: colors.text.primary 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.card}
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                Procedure di Preparazione
              </h1>
              <p style={{ color: colors.text.muted }}>
                Gestisci le procedure di preparazione per ogni prodotto
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
            <input
              type="text"
              placeholder="Cerca prodotti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: filterType === "all" ? colors.button.primary : colors.bg.card,
                color: filterType === "all" ? colors.button.primaryText : colors.text.secondary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              Tutti ({products.length})
            </button>
            <button
              onClick={() => setFilterType("with")}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: filterType === "with" ? colors.button.success : colors.bg.card,
                color: filterType === "with" ? colors.button.successText : colors.text.secondary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              Con procedura ({products.filter(p => p.ProductProcedure).length})
            </button>
            <button
              onClick={() => setFilterType("without")}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: filterType === "without" ? colors.button.danger : colors.bg.card,
                color: filterType === "without" ? 'white' : colors.text.secondary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              Senza procedura ({products.filter(p => !p.ProductProcedure).length})
            </button>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse">
                <div 
                  className="rounded-lg p-6"
                  style={{ 
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  <div className="h-6 w-3/4 rounded mb-4" style={{ backgroundColor: colors.bg.hover }}></div>
                  <div className="h-4 w-1/2 rounded mb-6" style={{ backgroundColor: colors.bg.hover }}></div>
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded" style={{ backgroundColor: colors.bg.hover }}></div>
                    <div className="h-3 w-5/6 rounded" style={{ backgroundColor: colors.bg.hover }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="rounded-lg p-6 transition-all duration-200 hover:shadow-lg"
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: product.ProductProcedure ? colors.border.success : colors.border.primary,
                  borderWidth: '2px',
                  borderStyle: 'solid'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1" style={{ color: colors.text.primary }}>
                      {product.name}
                    </h3>
                    <p className="text-sm" style={{ color: colors.text.muted }}>
                      {product.category?.name || "Senza categoria"}
                      {product.subcategory && ` > ${product.subcategory.name}`}
                    </p>
                  </div>
                  {product.ProductProcedure ? (
                    <div 
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: colors.border.success + '20',
                        color: colors.text.success
                      }}
                    >
                      <FileText className="h-3 w-3 inline mr-1" />
                      Procedura
                    </div>
                  ) : (
                    <div 
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: colors.bg.hover,
                        color: colors.text.secondary
                      }}
                    >
                      Nessuna
                    </div>
                  )}
                </div>

                {product.ProductProcedure && (
                  <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                    <p className="text-sm font-medium mb-2" style={{ color: colors.text.primary }}>
                      Procedura:
                    </p>
                    <ul className="space-y-1">
                      {product.ProductProcedure.ProcedureStep
                        .sort((a, b) => a.order - b.order)
                        .slice(0, 2)
                        .map((step, index) => (
                          <li key={step.id} className="text-sm" style={{ color: colors.text.secondary }}>
                            {index + 1}. {step.description.substring(0, 50)}...
                          </li>
                        ))}
                      {product.ProductProcedure.ProcedureStep.length > 2 && (
                        <li className="text-sm italic" style={{ color: colors.text.muted }}>
                          + altri {product.ProductProcedure.ProcedureStep.length - 2} passaggi
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => openProcedureModal(product)}
                    className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    style={{ 
                      backgroundColor: colors.button.primary,
                      color: colors.button.primaryText
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
                  >
                    {product.ProductProcedure ? (
                      <>
                        <Edit2 className="h-4 w-4" />
                        Modifica
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Crea Procedura
                      </>
                    )}
                  </button>
                  {product.ProductProcedure && (
                    <button
                      onClick={() => deleteProcedure(product.id)}
                      className="px-4 py-2 rounded-lg transition-colors"
                      style={{ 
                        backgroundColor: colors.text.error,
                        color: 'white'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
            <p className="text-lg font-medium mb-1" style={{ color: colors.text.primary }}>
              Nessun prodotto trovato
            </p>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Prova a modificare i filtri di ricerca
            </p>
          </div>
        )}

        {/* Procedure Modal */}
        {selectedProduct && (
          <ProcedureModal
            isOpen={showProcedureModal}
            onClose={() => {
              setShowProcedureModal(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            categories={[]}
            onSuccess={() => {
              loadProducts();
              setShowProcedureModal(false);
              setSelectedProduct(null);
            }}
          />
        )}
      </div>
    </AuthGuard>
  );
}