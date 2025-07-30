"use client";

import { useState, useEffect } from "react";
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter,
  Upload,
  Download,
  Save,
  X,
  Eye,
  EyeOff
} from "lucide-react";
import { 
  getCategories, 
  getProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  createCategory,
  createSubcategory
} from "@/lib/actions/products";
import { importProductsFromCSV, generateCSVTemplate, generateSimpleTemplate } from "@/lib/actions/import-products";
import { AuthGuard } from "@/components/auth-guard";

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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    categoryId: "",
    subcategoryId: "",
    available: true
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon: "",
    order: ""
  });

  const [subcategoryForm, setSubcategoryForm] = useState({
    name: "",
    categoryId: "",
    order: ""
  });

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

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
      
      setCategories(categoriesData);
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

  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      price: "",
      imageUrl: "",
      categoryId: "",
      subcategoryId: "",
      available: true
    });
    setEditingProduct(null);
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || "",
        price: product.price?.toString() || "",
        imageUrl: product.imageUrl || "",
        categoryId: product.categoryId?.toString() || "",
        subcategoryId: product.subcategoryId?.toString() || "",
        available: product.available
      });
    } else {
      resetProductForm();
    }
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name: productForm.name,
      description: productForm.description || undefined,
      price: productForm.price ? parseFloat(productForm.price) : undefined,
      imageUrl: productForm.imageUrl || undefined,
      categoryId: productForm.categoryId ? parseInt(productForm.categoryId) : undefined,
      subcategoryId: productForm.subcategoryId ? parseInt(productForm.subcategoryId) : undefined,
      available: productForm.available
    };

    const result = editingProduct 
      ? await updateProduct(editingProduct.id, data)
      : await createProduct(data);

    if (result.success) {
      setShowProductModal(false);
      resetProductForm();
      await loadData();
      alert(`✅ Prodotto ${editingProduct ? 'aggiornato' : 'creato'} con successo!`);
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
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

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createCategory({
      name: categoryForm.name,
      icon: categoryForm.icon || undefined,
      order: categoryForm.order ? parseInt(categoryForm.order) : undefined
    });

    if (result.success) {
      setShowCategoryModal(false);
      setCategoryForm({ name: "", icon: "", order: "" });
      await loadData();
      alert("✅ Categoria creata con successo!");
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  const handleSubcategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createSubcategory({
      name: subcategoryForm.name,
      categoryId: parseInt(subcategoryForm.categoryId),
      order: subcategoryForm.order ? parseInt(subcategoryForm.order) : undefined
    });

    if (result.success) {
      setShowSubcategoryModal(false);
      setSubcategoryForm({ name: "", categoryId: "", order: "" });
      await loadData();
      alert("✅ Sottocategoria creata con successo!");
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  const getProductLocation = (product: Product) => {
    if (product.subcategory) {
      return `${product.subcategory.category?.name} > ${product.subcategory.name}`;
    } else if (product.category) {
      return product.category.name;
    }
    return "Senza categoria";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (validTypes.includes(file.type) || file.name.endsWith('.csv')) {
        setImportFile(file);
        setImportResults(null);
      } else {
        alert('Tipo di file non supportato. Usa CSV o Excel.');
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResults(null);

    try {
      const text = await importFile.text();
      const result = await importProductsFromCSV(text);
      
      setImportResults(result);
      
      if (result.success) {
        await loadData(); // Ricarica i dati
        if (result.errors.length === 0) {
          alert(`✅ Importazione completata! ${result.created} creati, ${result.updated} aggiornati.`);
        }
      }
    } catch (error) {
      alert('❌ Errore durante l\'importazione del file');
      console.error('Errore importazione:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = async (simple = false) => {
    try {
      const csvContent = simple ? await generateSimpleTemplate() : await generateCSVTemplate();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = simple ? 'elenco-prodotti-semplice.txt' : 'template-prodotti.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('❌ Errore durante il download del template');
    }  
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-white/60" />
            <h1 className="text-2xl font-bold text-foreground">Gestione Prodotti</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Importa CSV/Excel
            </button>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuova Categoria
            </button>
            <button
              onClick={() => setShowSubcategoryModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuova Sottocategoria
            </button>
            <button
              onClick={() => openProductModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuovo Prodotto
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cerca prodotti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground"
            />
          </div>

          <select
            value={selectedCategory || ""}
            onChange={(e) => {
              setSelectedCategory(e.target.value ? parseInt(e.target.value) : null);
              setSelectedSubcategory(null);
            }}
            className="px-4 py-2 bg-background border border-border rounded-lg text-foreground"
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
            className="px-4 py-2 bg-background border border-border rounded-lg text-foreground disabled:opacity-50"
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
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              showAvailableOnly 
                ? "bg-green-600 text-white" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {showAvailableOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Solo disponibili
          </button>

          <button
            onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              showIncompleteOnly 
                ? "bg-white/20 text-white" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Filter className="h-4 w-4" />
            Da completare
          </button>

          <div className="text-sm text-muted-foreground self-center">
            {filteredProducts.length} di {products.length} prodotti
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/15-400 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Caricamento prodotti...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="bg-card border border-border rounded-lg p-4 hover:border-white/15-500/50 transition-colors"
            >
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-foreground">{product.name}</h3>
                  <div className={`px-2 py-1 rounded text-xs ${
                    product.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {product.available ? "Disponibile" : "Non disponibile"}
                  </div>
                </div>

                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className={`text-lg font-bold ${
                    product.price ? "text-white/60" : "text-white/70"
                  }`}>
                    {product.price ? `€${product.price.toFixed(2)}` : "⚠️ Da completare"}
                  </span>
                  <span className={`text-xs ${
                    getProductLocation(product) === "Senza categoria" 
                      ? "text-white/70" 
                      : "text-muted-foreground"
                  }`}>
                    {getProductLocation(product)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => openProductModal(product)}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center justify-center gap-2"
                  >
                    <Edit2 className="h-3 w-3" />
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowProductModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {editingProduct ? "Modifica Prodotto" : "Nuovo Prodotto"}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Descrizione
                </label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Prezzo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  URL Immagine
                </label>
                <input
                  type="url"
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoria
                </label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm(prev => ({ 
                    ...prev, 
                    categoryId: e.target.value,
                    subcategoryId: "" // Reset sottocategoria
                  }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="">Seleziona categoria</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {productForm.categoryId && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Sottocategoria (opzionale)
                  </label>
                  <select
                    value={productForm.subcategoryId}
                    onChange={(e) => setProductForm(prev => ({ 
                      ...prev, 
                      subcategoryId: e.target.value,
                      categoryId: e.target.value ? "" : prev.categoryId // Reset categoria se si seleziona sottocategoria
                    }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  >
                    <option value="">Nessuna sottocategoria</option>
                    {categories
                      .find(cat => cat.id === parseInt(productForm.categoryId))
                      ?.subcategories.map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={productForm.available}
                  onChange={(e) => setProductForm(prev => ({ ...prev, available: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="available" className="text-sm text-muted-foreground">
                  Prodotto disponibile
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {editingProduct ? "Aggiorna" : "Crea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCategoryModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Nuova Categoria</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Icona (emoji)
                </label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, icon: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  placeholder="🍕"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Ordine
                </label>
                <input
                  type="number"
                  value={categoryForm.order}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, order: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {showSubcategoryModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowSubcategoryModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Nuova Sottocategoria</h3>
              <button
                onClick={() => setShowSubcategoryModal(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubcategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoria Padre *
                </label>
                <select
                  value={subcategoryForm.categoryId}
                  onChange={(e) => setSubcategoryForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  required
                >
                  <option value="">Seleziona categoria</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={subcategoryForm.name}
                  onChange={(e) => setSubcategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Ordine
                </label>
                <input
                  type="number"
                  value={subcategoryForm.order}
                  onChange={(e) => setSubcategoryForm(prev => ({ ...prev, order: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubcategoryModal(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowImportModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Importa Prodotti da CSV/Excel</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResults(null);
                }}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Template Download */}
              <div className="bg-blue-50 border border-white/15-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">1. Scarica un Template</h4>
                <p className="text-blue-700 text-sm mb-3">
                  Scegli il tipo di template che preferisci usare:
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => downloadTemplate(true)}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    📝 Elenco Semplice (solo nomi prodotti)
                  </button>
                  <button
                    onClick={() => downloadTemplate(false)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    📊 Template Completo (con prezzi e categorie)
                  </button>
                </div>
                <div className="mt-2 text-xs text-blue-600">
                  💡 <strong>Suggerimento:</strong> Usa l'elenco semplice se hai solo i nomi dei prodotti. 
                  Potrai aggiungere prezzi e categorie successivamente modificando ogni prodotto.
                </div>
              </div>

              {/* File Upload */}
              <div className="bg-green-50 border border-white/15-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">2. Carica il tuo File</h4>
                <p className="text-green-700 text-sm mb-3">
                  Seleziona il file CSV o Excel con i prodotti da importare.
                </p>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                  />
                  {importFile && (
                    <div className="text-sm text-green-700">
                      ✅ File selezionato: {importFile.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Import Button */}
              {importFile && (
                <div className="bg-amber-50 border border-white/20-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-800 mb-2">3. Avvia Importazione</h4>
                  <p className="text-amber-700 text-sm mb-3">
                    Clicca per iniziare l'importazione. I prodotti esistenti saranno aggiornati.
                  </p>
                  <button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="px-4 py-2 bg-white/20 hover:bg-white/25-700 disabled:bg-white/10 text-white rounded-lg flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Avvia Importazione
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Results */}
              {importResults && (
                <div className={`border rounded-lg p-4 ${
                  importResults.success 
                    ? 'bg-green-50 border-white/15-200' 
                    : 'bg-red-50 border-white/10-200'
                }`}>
                  <h4 className={`font-semibold mb-2 ${
                    importResults.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Risultati Importazione
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className={importResults.success ? 'text-green-700' : 'text-red-700'}>
                      📊 Righe elaborate: {importResults.processed}
                    </div>
                    {importResults.success && (
                      <>
                        <div className="text-green-700">✅ Prodotti creati: {importResults.created}</div>
                        <div className="text-green-700">🔄 Prodotti aggiornati: {importResults.updated}</div>
                      </>
                    )}
                    
                    {importResults.errors && importResults.errors.length > 0 && (
                      <div className="mt-3">
                        <div className="text-red-700 font-medium mb-1">⚠️ Errori:</div>
                        <div className="bg-red-100 border border-white/10-200 rounded p-2 max-h-32 overflow-y-auto">
                          {importResults.errors.map((error: string, index: number) => (
                            <div key={index} className="text-red-600 text-xs">{error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Format Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-2">Formati Supportati</h4>
                <div className="text-slate-700 text-sm space-y-3">
                  <div>
                    <div className="font-semibold text-green-700">📝 Elenco Semplice:</div>
                    <p className="text-xs mb-1">Un nome prodotto per riga, senza header:</p>
                    <div className="bg-green-100 p-2 rounded text-xs font-mono">
                      Caffè Espresso<br/>
                      Cappuccino<br/>
                      Brioche alla marmellata
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-semibold text-blue-700">📊 CSV Completo:</div>
                    <p className="text-xs mb-1">Con header e colonne:</p>
                    <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                      <li><code>name</code> - Nome prodotto (obbligatorio)</li>
                      <li><code>description</code> - Descrizione</li>
                      <li><code>price</code> - Prezzo (es: 12.50)</li>
                      <li><code>imageUrl</code> - URL immagine</li>
                      <li><code>categoryName</code> - Nome categoria</li>
                      <li><code>subcategoryName</code> - Nome sottocategoria</li>
                      <li><code>available</code> - Disponibile (true/false)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}