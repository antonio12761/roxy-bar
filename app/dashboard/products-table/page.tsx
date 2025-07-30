"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter,
  ArrowLeft,
  ArrowUpDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  Download,
  Upload,
  Settings,
  Grid3X3,
  Table as TableIcon,
  X
} from "lucide-react";
import { getCategories } from "@/lib/actions/products";
import {
  getProdottiWithCategories,
  createProdottoSync,
  updateProdottoSync,
  deleteProdottoSync
} from "@/lib/actions/products-sync";
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
  nome: string;
  descrizione?: string | null;
  prezzo: any;
  immagine?: string | null;
  disponibile: boolean;
  categoryId?: number | null;
  subcategoryId?: number | null;
  category?: Category | null;
  subcategory?: Subcategory | null;
  createdAt: Date;
  updatedAt: Date;
}

type SortField = 'name' | 'price' | 'category' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface CategoryWithCount extends Category {
  productsCount: number;
}

export default function ProductsTablePage() {
  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  
  // Sorting states
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    available: true,
    categoryId: "",
    subcategoryId: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData] = await Promise.all([
        getProdottiWithCategories(),
        getCategories()
      ]);
      setProducts(productsData as Product[]);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting logic
  const filteredAndSortedProducts = products
    .filter(product => {
      const matchesSearch = product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      
      const matchesCategory = selectedCategory === "all" || 
                             product.categoryId?.toString() === selectedCategory ||
                             product.subcategoryId?.toString() === selectedCategory;
      
      const matchesAvailability = availabilityFilter === "all" ||
                                 (availabilityFilter === "available" && product.disponibile) ||
                                 (availabilityFilter === "unavailable" && !product.disponibile);
      
      const matchesPrice = (!priceRange.min || Number(product.prezzo) >= parseFloat(priceRange.min)) &&
                          (!priceRange.max || Number(product.prezzo) <= parseFloat(priceRange.max));
      
      return matchesSearch && matchesCategory && matchesAvailability && matchesPrice;
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortField) {
        case 'name':
          aValue = a.nome.toLowerCase();
          bValue = b.nome.toLowerCase();
          break;
        case 'price':
          aValue = Number(a.prezzo);
          bValue = Number(b.prezzo);
          break;
        case 'category':
          aValue = a.category?.name?.toLowerCase() || '';
          bValue = b.category?.name?.toLowerCase() || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          aValue = a.nome.toLowerCase();
          bValue = b.nome.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredAndSortedProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredAndSortedProducts.map(p => p.id));
    }
  };

  const handleSelectProduct = (productId: number) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleDelete = async (productId: number) => {
    try {
      await deleteProdottoSync(productId);
      await loadData();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Errore eliminazione prodotto:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0 || !confirm(`Eliminare ${selectedProducts.length} prodotti selezionati?`)) {
      return;
    }
    
    try {
      await Promise.all(selectedProducts.map(id => deleteProdottoSync(id)));
      await loadData();
      setSelectedProducts([]);
    } catch (error) {
      console.error("Errore eliminazione multipla:", error);
    }
  };

  const toggleAvailability = async (product: Product) => {
    try {
      await updateProdottoSync(product.id, { available: !product.disponibile });
      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento disponibilità:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      imageUrl: "",
      available: true,
      categoryId: "",
      subcategoryId: ""
    });
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    try {
      await createProdottoSync({
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        imageUrl: formData.imageUrl || undefined,
        available: formData.available,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
        subcategoryId: formData.subcategoryId ? parseInt(formData.subcategoryId) : undefined
      });
      
      await loadData();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error("Errore creazione prodotto:", error);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !formData.name || !formData.price) return;

    try {
      await updateProdottoSync(editingProduct.id, {
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        imageUrl: formData.imageUrl || undefined,
        available: formData.available,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
        subcategoryId: formData.subcategoryId ? parseInt(formData.subcategoryId) : undefined
      });
      
      await loadData();
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      console.error("Errore aggiornamento prodotto:", error);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.nome,
      description: product.descrizione || "",
      price: product.prezzo.toString(),
      imageUrl: product.immagine || "",
      available: product.disponibile,
      categoryId: product.categoryId?.toString() || "",
      subcategoryId: product.subcategoryId?.toString() || ""
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingProduct(null);
    resetForm();
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-left font-medium text-gray-300 hover:text-white transition-colors"
    >
      {children}
      <ArrowUpDown className={`h-4 w-4 ${sortField === field ? 'text-white/70' : 'text-gray-500'}`} />
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento prodotti...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-white/70" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <TableIcon className="h-8 w-8 text-white/70" />
              Gestione Prodotti - Tabella
            </h1>
            <p className="text-gray-400">Gestisci i prodotti del tuo menu con vista tabellare</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/products"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Grid3X3 className="h-4 w-4" />
              Vista Griglia
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuovo Prodotto
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca prodotti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showFilters 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtri
            </button>

            {/* Bulk Actions */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {selectedProducts.length} selezionati
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </button>
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-600">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Tutte le categorie</option>
                  {categories.map(category => (
                    <optgroup key={category.id} label={category.name}>
                      <option value={category.id.toString()}>{category.name}</option>
                      {category.subcategories.map(sub => (
                        <option key={sub.id} value={sub.id.toString()}>
                          └ {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Availability Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Disponibilità</label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Tutti</option>
                  <option value="available">Disponibili</option>
                  <option value="unavailable">Non disponibili</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Prezzo min</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="€ min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Prezzo max</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="€ max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr>
                <th className="p-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredAndSortedProducts.length && filteredAndSortedProducts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-white/90 focus:ring-amber-500"
                  />
                </th>
                <th className="p-4 text-left">Immagine</th>
                <th className="p-4 text-left">
                  <SortButton field="name">Nome</SortButton>
                </th>
                <th className="p-4 text-left">
                  <SortButton field="category">Categoria</SortButton>
                </th>
                <th className="p-4 text-left">
                  <SortButton field="price">Prezzo</SortButton>
                </th>
                <th className="p-4 text-left">Disponibilità</th>
                <th className="p-4 text-left">
                  <SortButton field="updatedAt">Ultimo Aggiornamento</SortButton>
                </th>
                <th className="p-4 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedProducts.map((product) => (
                <tr key={product.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleSelectProduct(product.id)}
                      className="rounded border-gray-300 text-white/90 focus:ring-amber-500"
                    />
                  </td>
                  <td className="p-4">
                    {product.immagine ? (
                      <img
                        src={product.immagine}
                        alt={product.nome}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium text-white">{product.nome}</div>
                      {product.descrizione && (
                        <div className="text-sm text-gray-400 truncate max-w-xs">
                          {product.descrizione}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="text-white">
                        {product.category?.name || 'Senza categoria'}
                      </div>
                      {product.subcategory && (
                        <div className="text-gray-400">
                          {product.subcategory.name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-white">
                      €{Number(product.prezzo).toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleAvailability(product)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        product.disponibile
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {product.disponibile ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {product.disponibile ? 'Disponibile' : 'Non disponibile'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-400">
                      {new Date(product.updatedAt).toLocaleDateString('it-IT')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 text-white/60 hover:bg-blue-600/20 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(product.id)}
                        className="p-2 text-white/50 hover:bg-red-600/20 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nessun prodotto trovato</h3>
            <p className="text-gray-400">
              {searchTerm || selectedCategory !== "all" || availabilityFilter !== "all" || priceRange.min || priceRange.max
                ? "Prova a modificare i filtri di ricerca"
                : "Inizia aggiungendo il tuo primo prodotto"
              }
            </p>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="mt-6 bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex justify-between items-center text-sm text-gray-400">
          <div>
            Visualizzati {filteredAndSortedProducts.length} di {products.length} prodotti
          </div>
          <div className="flex gap-6">
            <span>Disponibili: {products.filter(p => p.disponibile).length}</span>
            <span>Non disponibili: {products.filter(p => !p.disponibile).length}</span>
          </div>
        </div>
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div 
            className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Nuovo Prodotto</h3>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome Prodotto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Es: Caffè Espresso"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prezzo (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrizione
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Descrizione del prodotto..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL Immagine
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categoria
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        categoryId: e.target.value,
                        subcategoryId: "" // Reset subcategory when category changes
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Seleziona categoria</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id.toString()}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sottocategoria
                  </label>
                  <select
                    value={formData.subcategoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, subcategoryId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={!formData.categoryId}
                  >
                    <option value="">Seleziona sottocategoria</option>
                    {formData.categoryId && categories
                      .find(c => c.id.toString() === formData.categoryId)
                      ?.subcategories.map(subcategory => (
                        <option key={subcategory.id} value={subcategory.id.toString()}>
                          {subcategory.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData(prev => ({ ...prev, available: e.target.checked }))}
                  className="rounded border-gray-300 text-white/90 focus:ring-amber-500"
                />
                <label htmlFor="available" className="text-sm text-gray-300">
                  Prodotto disponibile
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Crea Prodotto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div 
            className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Modifica Prodotto</h3>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome Prodotto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Es: Caffè Espresso"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prezzo (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrizione
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Descrizione del prodotto..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL Immagine
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categoria
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        categoryId: e.target.value,
                        subcategoryId: "" // Reset subcategory when category changes
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Seleziona categoria</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id.toString()}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sottocategoria
                  </label>
                  <select
                    value={formData.subcategoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, subcategoryId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={!formData.categoryId}
                  >
                    <option value="">Seleziona sottocategoria</option>
                    {formData.categoryId && categories
                      .find(c => c.id.toString() === formData.categoryId)
                      ?.subcategories.map(subcategory => (
                        <option key={subcategory.id} value={subcategory.id.toString()}>
                          {subcategory.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available-edit"
                  checked={formData.available}
                  onChange={(e) => setFormData(prev => ({ ...prev, available: e.target.checked }))}
                  className="rounded border-gray-300 text-white/90 focus:ring-amber-500"
                />
                <label htmlFor="available-edit" className="text-sm text-gray-300">
                  Prodotto disponibile
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div 
            className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Conferma Eliminazione</h3>
            <p className="text-gray-400 mb-6">
              Sei sicuro di voler eliminare questo prodotto? Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}