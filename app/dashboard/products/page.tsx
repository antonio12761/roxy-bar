"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { 
  Package, 
  Plus, 
  Search, 
  Filter,
  Upload,
  Eye,
  EyeOff,
  ArrowLeft,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Beer
} from "lucide-react";
import Link from "next/link";
import { 
  getCategories, 
  getProducts, 
  deleteProduct
} from "@/lib/actions/products";
import { 
  importProductsFromExcel, 
  deleteAllProducts, 
  getProductsStats,
  getAllProducts,
  markBeersAsRequiringGlasses 
} from "@/lib/actions/products-import";
import { AuthGuard } from "@/components/auth-guard";
import { useTheme } from "@/contexts/ThemeContext";

// Import modal components
import { ProductModal } from "./components/ProductModal";
import { CategoryModal } from "./components/CategoryModal";
import { SubcategoryModal } from "./components/SubcategoryModal";
import { ImportModal } from "./components/ImportModal";
import { ProductCard } from "./components/ProductCard";
import { ProcedureModal } from "./components/ProcedureModal";

interface Category {
  id: number;
  name: string;
  icon?: string | null;
  order: number;
  productsCount: number;
  subcategories: Subcategory[];
}

interface Subcategory {
  id: number;
  name: string;
  order: number;
  categoryId: number;
  productsCount?: number;
  category?: Category;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  available: boolean;
  categoryId?: number;
  subcategoryId?: number;
  category?: Category;
  subcategory?: Subcategory;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function ProductsPage() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  
  // New states for Excel import
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Page skeleton component
  const PageSkeleton = () => (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.bg.main }}>
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div 
            className="p-2 rounded-lg w-10 h-10"
            style={{ backgroundColor: colors.bg.card }}
          />
          <div>
            <div 
              className="h-8 w-48 rounded mb-2 animate-pulse"
              style={{ backgroundColor: colors.bg.card }}
            />
            <div 
              className="h-5 w-64 rounded animate-pulse"
              style={{ backgroundColor: colors.bg.card }}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i}
              className="h-10 w-32 rounded-lg animate-pulse"
              style={{ backgroundColor: colors.bg.card }}
            />
          ))}
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i}
            className="h-10 rounded-lg animate-pulse"
            style={{ backgroundColor: colors.bg.card }}
          />
        ))}
      </div>

      {/* Products grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div 
            key={i}
            className="rounded-lg p-4 animate-pulse"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div 
              className="h-48 rounded-lg mb-4"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div 
              className="h-5 w-3/4 rounded mb-2"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div 
              className="h-4 w-full rounded mb-1"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div 
              className="h-4 w-2/3 rounded mb-4"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div className="flex justify-between items-center mb-4">
              <div 
                className="h-6 w-16 rounded"
                style={{ backgroundColor: colors.bg.darker }}
              />
              <div 
                className="h-5 w-24 rounded"
                style={{ backgroundColor: colors.bg.darker }}
              />
            </div>
            <div className="flex gap-2">
              <div 
                className="h-8 flex-1 rounded"
                style={{ backgroundColor: colors.bg.darker }}
              />
              <div 
                className="h-8 w-8 rounded"
                style={{ backgroundColor: colors.bg.darker }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  
  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [procedureProduct, setProcedureProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, selectedSubcategory, showAvailableOnly, showIncompleteOnly]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesData, productsData] = await Promise.all([
        getCategories(),
        getProducts()
      ]);
      
      // Ensure all categories have subcategories array
      const categoriesWithSubcategories = categoriesData.map(cat => ({
        ...cat,
        subcategories: cat.subcategories || []
      }));
      
      setCategories(categoriesWithSubcategories);
      setProducts(productsData);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(product => 
        product.categoryId === selectedCategory || 
        product.subcategory?.categoryId === selectedCategory
      );
    }

    if (selectedSubcategory) {
      filtered = filtered.filter(product => 
        product.subcategoryId === selectedSubcategory
      );
    }

    if (showAvailableOnly) {
      filtered = filtered.filter(product => product.available);
    }

    if (showIncompleteOnly) {
      filtered = filtered.filter(product => 
        !product.price || 
        (!product.categoryId && !product.subcategoryId)
      );
    }

    setFilteredProducts(filtered);
  };

  const openProductModal = (product?: Product) => {
    setEditingProduct(product || null);
    setShowProductModal(true);
  };

  const openProcedureModal = (product: Product) => {
    setProcedureProduct(product);
    setShowProcedureModal(true);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Sei sicuro di voler eliminare "${product.name}"?`)) return;

    const result = await deleteProduct(product.id);
    if (result.success) {
      await loadData();
      alert("✅ Prodotto eliminato con successo!");
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  // Handle Excel file upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type)) {
      alert('❌ Per favore carica un file Excel (.xlsx o .xls)');
      return;
    }

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await importProductsFromExcel(buffer);
      
      if (result.success) {
        setImportStats(result);
        await loadData();
        alert(`✅ Importazione completata!\n\nProdotti creati: ${result.prodottiCreati}\nProdotti aggiornati: ${result.prodottiAggiornati}\nErrori: ${result.errori}`);
      } else {
        alert(`❌ Errore durante l'importazione: ${result.error}`);
      }
    } catch (error) {
      console.error('Errore upload:', error);
      alert('❌ Errore durante il caricamento del file');
    } finally {
      setIsImporting(false);
      // Reset input
      event.target.value = '';
    }
  };

  // Handle delete all products
  const handleDeleteAllProducts = async () => {
    setShowDeleteConfirm(false);
    
    const result = await deleteAllProducts();
    if (result.success) {
      await loadData();
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  // Handle mark beers as requiring glasses
  const handleMarkBeersRequireGlasses = async () => {
    const result = await markBeersAsRequiringGlasses();
    if (result.success) {
      await loadData();
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  // Show full page skeleton during initial load
  if (isLoading && products.length === 0) {
    return (
      <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
        <PageSkeleton />
      </AuthGuard>
    );
  }

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
                Gestione Prodotti
              </h1>
              <p style={{ color: colors.text.muted }}>Gestisci il catalogo prodotti del bar</p>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 mb-4">
            {/* Excel Import Button */}
            <label className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
                disabled={isImporting}
              />
              <div
                className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 cursor-pointer"
                style={{ 
                  backgroundColor: isImporting ? colors.bg.card : colors.button.success, 
                  color: isImporting ? colors.text.muted : colors.button.successText,
                  opacity: isImporting ? 0.6 : 1
                }}
                onMouseEnter={(e) => !isImporting && (e.currentTarget.style.backgroundColor = colors.button.successHover)}
                onMouseLeave={(e) => !isImporting && (e.currentTarget.style.backgroundColor = colors.button.success)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {isImporting ? 'Importazione...' : 'Importa Excel'}
              </div>
            </label>

            {/* Mark Beers Button */}
            <button
              onClick={handleMarkBeersRequireGlasses}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.warning || '#f59e0b', 
                color: colors.button.warningText || '#ffffff'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.warningHover || '#d97706'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.warning || '#f59e0b'}
            >
              <Beer className="h-4 w-4" />
              Marca Birre (Bicchiere)
            </button>

            {/* Delete All Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.danger, 
                color: colors.button.dangerText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.dangerHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.danger}
            >
              <Trash2 className="h-4 w-4" />
              Elimina Tutti
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.primary, 
                color: colors.button.primaryText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            >
              <Upload className="h-4 w-4" />
              Importa CSV
            </button>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.primary, 
                color: colors.button.primaryText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            >
              <Plus className="h-4 w-4" />
              Nuova Categoria
            </button>
            <button
              onClick={() => setShowSubcategoryModal(true)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.primary, 
                color: colors.button.primaryText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            >
              <Plus className="h-4 w-4" />
              Nuova Sottocategoria
            </button>
            <button
              onClick={() => openProductModal()}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.primary, 
                color: colors.button.primaryText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            >
              <Plus className="h-4 w-4" />
              Nuovo Prodotto
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="relative">
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

          <select
            value={selectedCategory || ""}
            onChange={(e) => {
              setSelectedCategory(e.target.value ? parseInt(e.target.value) : null);
              setSelectedSubcategory(null);
            }}
            className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
            style={{ 
              backgroundColor: colors.bg.input, 
              borderColor: colors.border.primary, 
              color: colors.text.primary,
              borderWidth: '1px', 
              borderStyle: 'solid' 
            }}
          >
            <option value="">Tutte le categorie</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name} ({category.productsCount})
              </option>
            ))}
          </select>

          <select
            value={selectedSubcategory || ""}
            onChange={(e) => setSelectedSubcategory(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!selectedCategory}
            className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{ 
              backgroundColor: colors.bg.input, 
              borderColor: colors.border.primary, 
              color: colors.text.primary,
              borderWidth: '1px', 
              borderStyle: 'solid' 
            }}
          >
            <option value="">Tutte le sottocategorie</option>
            {selectedCategory && categories
              .find(cat => cat.id === selectedCategory)
              ?.subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.productsCount})
                </option>
              ))
            }
          </select>

          <button
            onClick={() => setShowAvailableOnly(!showAvailableOnly)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ 
              backgroundColor: showAvailableOnly ? colors.button.success : colors.bg.card, 
              color: showAvailableOnly ? colors.button.successText : colors.text.secondary,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = showAvailableOnly ? colors.button.successHover : colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showAvailableOnly ? colors.button.success : colors.bg.card}
          >
            {showAvailableOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Solo disponibili
          </button>

          <button
            onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ 
              backgroundColor: showIncompleteOnly ? colors.button.primary : colors.bg.card, 
              color: showIncompleteOnly ? colors.button.primaryText : colors.text.secondary,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = showIncompleteOnly ? colors.button.primaryHover : colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showIncompleteOnly ? colors.button.primary : colors.bg.card}
          >
            <Filter className="h-4 w-4" />
            Da completare
          </button>

          <div className="text-sm self-center" style={{ color: colors.text.muted }}>
            {filteredProducts.length} di {products.length} prodotti
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Product skeleton cards */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div 
                key={i}
                className="rounded-lg p-4 animate-pulse"
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                {/* Image skeleton */}
                <div 
                  className="h-48 rounded-lg mb-4"
                  style={{ backgroundColor: colors.bg.darker }}
                />
                
                {/* Title skeleton */}
                <div 
                  className="h-5 w-3/4 rounded mb-2"
                  style={{ backgroundColor: colors.bg.darker }}
                />
                
                {/* Description skeleton */}
                <div 
                  className="h-4 w-full rounded mb-1"
                  style={{ backgroundColor: colors.bg.darker }}
                />
                <div 
                  className="h-4 w-2/3 rounded mb-4"
                  style={{ backgroundColor: colors.bg.darker }}
                />
                
                {/* Price and category skeleton */}
                <div className="flex justify-between items-center mb-4">
                  <div 
                    className="h-6 w-16 rounded"
                    style={{ backgroundColor: colors.bg.darker }}
                  />
                  <div 
                    className="h-5 w-24 rounded"
                    style={{ backgroundColor: colors.bg.darker }}
                  />
                </div>
                
                {/* Action buttons skeleton */}
                <div className="flex gap-2">
                  <div 
                    className="h-8 flex-1 rounded"
                    style={{ backgroundColor: colors.bg.darker }}
                  />
                  <div 
                    className="h-8 w-8 rounded"
                    style={{ backgroundColor: colors.bg.darker }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={(product) => openProductModal(product)}
                onDelete={handleDeleteProduct}
                onEditProcedure={openProcedureModal}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        <ProductModal
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          product={editingProduct}
          categories={categories}
          onSuccess={loadData}
        />

        <CategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={loadData}
        />

        <SubcategoryModal
          isOpen={showSubcategoryModal}
          onClose={() => setShowSubcategoryModal(false)}
          categories={categories}
          onSuccess={loadData}
        />

        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={loadData}
        />

        <ProcedureModal
          isOpen={showProcedureModal}
          onClose={() => {
            setShowProcedureModal(false);
            setProcedureProduct(null);
          }}
          productId={procedureProduct?.id || null}
          productName={procedureProduct?.name || ""}
          onSuccess={loadData}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div 
              className="p-6 rounded-lg max-w-md w-full mx-4"
              style={{ backgroundColor: colors.bg.card }}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <h3 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
                  Conferma Eliminazione
                </h3>
              </div>
              
              <p className="mb-6" style={{ color: colors.text.secondary }}>
                Sei sicuro di voler eliminare <strong>TUTTI</strong> i prodotti? 
                Questa azione non può essere annullata.
              </p>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6">
                <p className="text-sm text-red-600 dark:text-red-400">
                  ⚠️ Verranno eliminati {products.length} prodotti dal database.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg transition-colors duration-200"
                  style={{ 
                    backgroundColor: colors.bg.hover, 
                    color: colors.text.primary 
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteAllProducts}
                  className="px-4 py-2 rounded-lg transition-colors duration-200"
                  style={{ 
                    backgroundColor: colors.button.danger, 
                    color: colors.button.dangerText 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.dangerHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.danger}
                >
                  Elimina Tutti
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Stats Display */}
        {importStats && (
          <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-sm"
               style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h4 className="font-semibold mb-2" style={{ color: colors.text.primary }}>
              Risultati Importazione
            </h4>
            <div className="space-y-1 text-sm" style={{ color: colors.text.secondary }}>
              <p>✅ Creati: {importStats.prodottiCreati}</p>
              <p>📝 Aggiornati: {importStats.prodottiAggiornati}</p>
              {importStats.errori > 0 && <p>❌ Errori: {importStats.errori}</p>}
              <p>📊 Totale: {importStats.totaleProcessati}</p>
            </div>
            <button
              onClick={() => setImportStats(null)}
              className="mt-3 text-xs underline"
              style={{ color: colors.text.muted }}
            >
              Chiudi
            </button>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}