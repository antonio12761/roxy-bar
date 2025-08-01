"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Package,
  Folder,
  FolderOpen,
  GripVertical,
  X,
  Save,
  Wine,
  Coffee,
  Beer,
  Martini,
  GlassWater,
  IceCream,
  Sandwich,
  Pizza
} from "lucide-react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  reorderCategories,
  reorderSubcategories,
  type Category,
  type Subcategory
} from "@/lib/actions/categories";
import { AuthGuard } from "@/components/auth-guard";

// Icone disponibili per le categorie
const CATEGORY_ICONS = [
  { icon: Wine, name: "wine", label: "Vino" },
  { icon: Coffee, name: "coffee", label: "Caffè" },
  { icon: Beer, name: "beer", label: "Birra" },
  { icon: Martini, name: "martini", label: "Cocktail" },
  { icon: GlassWater, name: "glass-water", label: "Bevande" },
  { icon: IceCream, name: "ice-cream", label: "Gelati" },
  { icon: Sandwich, name: "sandwich", label: "Panini" },
  { icon: Pizza, name: "pizza", label: "Pizza" }
];

type CategoryWithSubcategories = Category & {
  Subcategory: (Subcategory & { _count: { Product: number } })[];
  _count: {
    Product: number;
    Subcategory: number;
  };
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithSubcategories | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    order: 0
  });
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: "",
    categoryId: 0,
    order: 0
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Errore caricamento categorie:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategory({
        name: formData.name,
        icon: formData.icon || undefined,
        order: formData.order
      });
      await loadCategories();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error("Errore creazione categoria:", error);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    
    try {
      await updateCategory(editingCategory.id, {
        name: formData.name,
        icon: formData.icon || undefined,
        order: formData.order
      });
      await loadCategories();
      setEditingCategory(null);
      resetForm();
    } catch (error) {
      console.error("Errore aggiornamento categoria:", error);
    }
  };

  const handleDeleteCategory = async (category: CategoryWithSubcategories) => {
    if ((category._count?.Product ?? 0) > 0) {
      alert(`Impossibile eliminare: la categoria contiene ${category._count?.Product ?? 0} prodotti`);
      return;
    }
    
    if ((category._count?.Subcategory ?? 0) > 0) {
      alert(`Impossibile eliminare: la categoria contiene ${category._count?.Subcategory ?? 0} sottocategorie`);
      return;
    }
    
    if (!confirm(`Eliminare la categoria "${category.name}"?`)) return;
    
    try {
      await deleteCategory(category.id);
      await loadCategories();
    } catch (error) {
      console.error("Errore eliminazione categoria:", error);
      if (error instanceof Error) {
        alert(error.message);
      }
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSubcategory({
        name: subcategoryFormData.name,
        categoryId: subcategoryFormData.categoryId,
        order: subcategoryFormData.order
      });
      await loadCategories();
      setShowSubcategoryModal(false);
      resetSubcategoryForm();
    } catch (error) {
      console.error("Errore creazione sottocategoria:", error);
    }
  };

  const handleUpdateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubcategory) return;
    
    try {
      await updateSubcategory(editingSubcategory.id, {
        name: subcategoryFormData.name,
        categoryId: subcategoryFormData.categoryId,
        order: subcategoryFormData.order
      });
      await loadCategories();
      setEditingSubcategory(null);
      resetSubcategoryForm();
    } catch (error) {
      console.error("Errore aggiornamento sottocategoria:", error);
    }
  };

  const handleDeleteSubcategory = async (subcategory: Subcategory & { _count?: { Product: number } }) => {
    if ((subcategory._count?.Product ?? 0) > 0) {
      alert(`Impossibile eliminare: la sottocategoria contiene ${subcategory._count?.Product ?? 0} prodotti`);
      return;
    }
    
    if (!confirm(`Eliminare la sottocategoria "${subcategory.name}"?`)) return;
    
    try {
      await deleteSubcategory(subcategory.id);
      await loadCategories();
    } catch (error) {
      console.error("Errore eliminazione sottocategoria:", error);
      if (error instanceof Error) {
        alert(error.message);
      }
    }
  };

  const openEditCategoryModal = (category: CategoryWithSubcategories) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || "",
      order: category.order
    });
  };

  const openEditSubcategoryModal = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryFormData({
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      order: subcategory.order
    });
  };

  const openCreateSubcategoryModal = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setSubcategoryFormData({
      name: "",
      categoryId: categoryId,
      order: 0
    });
    setShowSubcategoryModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "",
      order: 0
    });
  };

  const resetSubcategoryForm = () => {
    setSubcategoryFormData({
      name: "",
      categoryId: 0,
      order: 0
    });
    setSelectedCategoryId(null);
  };

  const getIconComponent = (iconName: string | null | undefined) => {
    if (!iconName) return Folder;
    const iconConfig = CATEGORY_ICONS.find(i => i.name === iconName);
    return iconConfig ? iconConfig.icon : Folder;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento categorie...</p>
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
              <Folder className="h-8 w-8 text-white/70" />
              Gestione Categorie
            </h1>
            <p className="text-gray-400">Organizza i tuoi prodotti in categorie e sottocategorie</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuova Categoria
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nessuna categoria</h3>
            <p className="text-gray-400 mb-6">Inizia creando la tua prima categoria</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Crea Categoria
            </button>
          </div>
        ) : (
          <>
            {categories.map((category) => {
              const Icon = getIconComponent(category.icon);
              const isExpanded = expandedCategories.has(category.id);
              
              return (
                <div key={category.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  {/* Category Row */}
                  <div className="flex items-center gap-3 p-4 hover:bg-slate-700/30 transition-colors">
                    <button
                      onClick={() => toggleExpanded(category.id)}
                      className="p-0.5 rounded transition-colors"
                      disabled={category.Subcategory.length === 0}
                    >
                      {category.Subcategory.length > 0 ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        )
                      ) : (
                        <div className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    <Icon className="h-4 w-4 text-white/70" />
                    
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{category.name}</h3>
                      <div className="flex gap-4 text-sm text-gray-400 mt-1">
                        <span>{category._count?.Product ?? 0} prodotti</span>
                        <span>{category._count?.Subcategory ?? 0} sottocategorie</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openCreateSubcategoryModal(category.id)}
                        className="p-1 text-white/60 hover:text-green-400 rounded transition-colors"
                        title="Aggiungi sottocategoria"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEditCategoryModal(category)}
                        className="p-1 text-white/60 hover:text-blue-400 rounded transition-colors"
                        title="Modifica"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="p-1 text-white/50 hover:text-red-400 rounded transition-colors"
                        title="Elimina"
                        disabled={(category._count?.Product ?? 0) > 0 || (category._count?.Subcategory ?? 0) > 0}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Subcategories */}
                  {isExpanded && category.Subcategory.length > 0 && (
                    <div className="bg-slate-900/30">
                      {category.Subcategory.map((subcategory) => (
                        <div
                          key={subcategory.id}
                          className="flex items-center gap-3 p-3 pl-12 hover:bg-slate-700/30 transition-colors border-t border-slate-700/50"
                        >
                          <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                          
                          <div className="flex-1">
                            <h4 className="text-white">{subcategory.name}</h4>
                            <span className="text-sm text-gray-400">
                              {subcategory._count?.Product || 0} prodotti
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditSubcategoryModal(subcategory)}
                              className="p-1 text-white/60 hover:text-blue-400 rounded transition-colors"
                              title="Modifica"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubcategory(subcategory)}
                              className="p-1 text-white/50 hover:text-red-400 rounded transition-colors"
                              title="Elimina"
                              disabled={(subcategory._count?.Product ?? 0) > 0}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Create Category Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setShowCreateModal(false);
            resetForm();
          }}
        >
          <div 
            className="bg-card border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Nuova Categoria</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Es: Distillati"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icona
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_ICONS.map(({ icon: Icon, name, label }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                      className={`p-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                        formData.icon === name
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                      }`}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ordine
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="0"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  Crea Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setEditingCategory(null);
            resetForm();
          }}
        >
          <div 
            className="bg-card border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Modifica Categoria</h3>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  resetForm();
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icona
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_ICONS.map(({ icon: Icon, name, label }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                      className={`p-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                        formData.icon === name
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                      }`}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ordine
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    resetForm();
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Subcategory Modal */}
      {showSubcategoryModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setShowSubcategoryModal(false);
            resetSubcategoryForm();
          }}
        >
          <div 
            className="bg-card border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Nuova Sottocategoria</h3>
              <button
                onClick={() => {
                  setShowSubcategoryModal(false);
                  resetSubcategoryForm();
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubcategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Sottocategoria *
                </label>
                <input
                  type="text"
                  required
                  value={subcategoryFormData.name}
                  onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Es: Gin"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categoria Padre
                </label>
                <div className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                  {categories.find(c => c.id === subcategoryFormData.categoryId)?.name || 'Seleziona categoria'}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ordine
                </label>
                <input
                  type="number"
                  value={subcategoryFormData.order}
                  onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="0"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubcategoryModal(false);
                    resetSubcategoryForm();
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  Crea Sottocategoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subcategory Modal */}
      {editingSubcategory && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setEditingSubcategory(null);
            resetSubcategoryForm();
          }}
        >
          <div 
            className="bg-card border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Modifica Sottocategoria</h3>
              <button
                onClick={() => {
                  setEditingSubcategory(null);
                  resetSubcategoryForm();
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateSubcategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Sottocategoria *
                </label>
                <input
                  type="text"
                  required
                  value={subcategoryFormData.name}
                  onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categoria Padre
                </label>
                <select
                  value={subcategoryFormData.categoryId}
                  onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, categoryId: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ordine
                </label>
                <input
                  type="number"
                  value={subcategoryFormData.order}
                  onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-muted border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSubcategory(null);
                    resetSubcategoryForm();
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}