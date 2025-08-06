"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { 
  Tag, 
  Edit2, 
  Trash2, 
  Plus, 
  Save, 
  X,
  Package,
  ArrowLeft,
  Merge,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  Search,
  Filter,
  Settings
} from "lucide-react";
import Link from "next/link";
import { getCategorieGerarchiche, getCategorie, rinominaCategoria, getProdottiByCategoria, spostaProddottiCategoria, unisciCategorie, creaCategoria, creaSottocategoria, eliminaCategoria } from "@/lib/actions/categorie";
import { rinominaCategoriaImproved } from "@/lib/actions/rinomina-categoria";
import { rinominaProdotto } from "@/lib/actions/rinomina-prodotto";
import { getCategorieGerarchicheV2, creaCategoriaV2, rinominaCategoriaV2, eliminaCategoriaV2 } from "@/lib/actions/categorie-v2";
import { getProdotti } from "@/lib/actions/ordinazioni";
import { bulkUpdateProductsWithPriceAdjustment } from "@/lib/actions/bulk-edit";
import { exportProductsCSV, importProductsCSV } from "@/lib/actions/products";
import { useTheme } from "@/contexts/ThemeContext";
import { Palette, Image as ImageIcon } from "lucide-react";
import { toast } from "@/lib/toast";

interface CategoriaGerarchica {
  nome: string;
  prodottiCount: number;
  prodottiDiretti: number;
  sottocategorie: {
    nome: string;
    fullPath: string;
    prodottiCount: number;
  }[];
}

interface CategoryIcon {
  id: number;
  categoryName: string;
  icon: string | null;
  iconType: string;
  color: string | null;
}

interface Categoria {
  nome: string;
  prodottiCount: number;
  parsed: {
    principale: string;
    sottocategoria: string | null;
    fullPath: string;
  };
}

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  codice?: number | null;
  disponibile?: boolean;
}

export default function CategoriePage() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  
  const [categorieGerarchiche, setCategorieGerarchiche] = useState<CategoriaGerarchica[]>([]);
  const [categorieFlat, setCategorieFlat] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [prodotti, setProdotti] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCreateSubModal, setShowCreateSubModal] = useState(false);
  const [selectedParentCategory, setSelectedParentCategory] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [draggedProduct, setDraggedProduct] = useState<Product | null>(null);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);
  const [globalSelectionMode, setGlobalSelectionMode] = useState(false);
  const [globalSelectedProducts, setGlobalSelectedProducts] = useState<{id: number, nome: string, categoria: string}[]>([]);
  const [showMoveToSubcategoryModal, setShowMoveToSubcategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    updated: number;
    created: number;
    errors: number;
    errorDetails: string[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAvailable, setFilterAvailable] = useState<boolean | null>(null);
  const [filterPriceRange, setFilterPriceRange] = useState<{min: number | null, max: number | null}>({min: null, max: null});
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    disponibile: null as boolean | null,
    terminato: null as boolean | null,
    categoria: null as string | null,
    priceAdjustment: null as {type: 'fixed' | 'percentage', value: number} | null
  });
  const [categoryIcons, setCategoryIcons] = useState<CategoryIcon[]>([]);
  const [editingIcon, setEditingIcon] = useState<string | null>(null);
  const [newIcon, setNewIcon] = useState("");
  const [newIconColor, setNewIconColor] = useState("#000000");
  const [uploadingIcon, setUploadingIcon] = useState<string | null>(null);
  const [showCategorySettingsModal, setShowCategorySettingsModal] = useState(false);
  const [selectedCategoryForSettings, setSelectedCategoryForSettings] = useState<string | null>(null);
  const [categorySettingsForm, setCategorySettingsForm] = useState({
    name: '',
    icon: '',
    iconType: 'emoji',
    color: '#000000'
  });

  useEffect(() => {
    loadCategorie();
    loadCategoryIcons();
  }, []);

  // Auto-select first category when categories are loaded
  useEffect(() => {
    if (categorieGerarchiche.length > 0 && !selectedCategory) {
      const firstCategory = categorieGerarchiche[0].nome;
      setSelectedCategory(firstCategory);
      loadProdotti(firstCategory);
    }
  }, [categorieGerarchiche]);

  // Filter products based on search and filters
  const filteredProdotti = prodotti.filter(product => {
    // Search filter
    if (searchQuery && !product.nome.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Availability filter
    if (filterAvailable !== null && product.disponibile !== filterAvailable) {
      return false;
    }
    
    // Price range filter
    if (filterPriceRange.min !== null && product.prezzo < filterPriceRange.min) {
      return false;
    }
    if (filterPriceRange.max !== null && product.prezzo > filterPriceRange.max) {
      return false;
    }
    
    return true;
  });

  const loadCategorie = async () => {
    setIsLoading(true);
    try {
      // Usa direttamente il metodo vecchio che sappiamo funziona
      const [gerarchiche, flat] = await Promise.all([
        getCategorieGerarchiche(),
        getCategorie()
      ]);
      
      setCategorieGerarchiche(gerarchiche);
      setCategorieFlat(flat);
      
      // Espandi automaticamente le categorie con sottocategorie
      const expanded = new Set<string>();
      gerarchiche.forEach(cat => {
        if (cat.sottocategorie.length > 0) {
          expanded.add(cat.nome);
        }
      });
      setExpandedCategories(expanded);
    } catch (error) {
      console.error("❌ Errore caricamento categorie:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryIcons = async () => {
    try {
      const response = await fetch('/api/dashboard/category-icons');
      if (response.ok) {
        const data = await response.json();
        setCategoryIcons(data);
      }
    } catch (error) {
      console.error('Errore caricamento icone:', error);
    }
  };

  const handleSaveIcon = async (categoryName: string) => {
    try {
      const response = await fetch('/api/dashboard/category-icons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName,
          icon: newIcon,
          iconType: 'emoji',
          color: newIconColor
        })
      });
      
      if (response.ok) {
        toast.success('Icona aggiornata');
        await loadCategoryIcons();
        setEditingIcon(null);
        setNewIcon('');
        setNewIconColor('#000000');
      }
    } catch (error) {
      console.error('Errore salvataggio icona:', error);
      toast.error('Errore nel salvataggio');
    }
  };

  const handleIconUpload = async (categoryName: string, file: File) => {
    setUploadingIcon(categoryName);
    
    const formData = new FormData();
    formData.append('icon', file);

    try {
      const response = await fetch(`/api/dashboard/category-icons/${encodeURIComponent(categoryName)}/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        toast.success('Icona caricata con successo');
        await loadCategoryIcons();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Errore nel caricamento dell\'icona');
      }
    } catch (error) {
      console.error('Errore upload icona:', error);
      toast.error('Errore nel caricamento dell\'icona');
    } finally {
      setUploadingIcon(null);
    }
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const handleRename = async (oldName: string) => {
    if (!newName.trim()) return;
    
    try {
      const result = await rinominaCategoria(oldName, newName.trim());
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        setEditingCategory(null);
        setNewName("");
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert("❌ Errore durante la rinomina");
    }
  };

  const loadProdotti = async (categoria: string) => {
    try {
      const data = await getProdottiByCategoria(categoria);
      setProdotti(data);
      setSelectedCategory(categoria);
      setSelectedProducts([]);
    } catch (error) {
      console.error("Errore caricamento prodotti:", error);
    }
  };

  const loadAllProdotti = async () => {
    try {
      const allProdotti = await getProdotti(); // Carica tutti i prodotti
      setProdotti(allProdotti);
      setSelectedCategory(null);
      setSelectedProducts([]);
    } catch (error) {
      console.error("Errore caricamento tutti i prodotti:", error);
    }
  };

  const handleMoveProducts = async (targetCategory: string) => {
    if (selectedProducts.length === 0) return;
    
    try {
      // Controlla se la categoria target è una nuova sottocategoria da creare
      if (targetCategory.includes(' > ') && !categorieFlat.some(cat => cat.nome === targetCategory)) {
        const [parentCategory, subcategoryName] = targetCategory.split(' > ');
        
        // Crea la sottocategoria prima
        const createResult = await creaCategoria(subcategoryName, parentCategory);
        if (!createResult.success) {
          alert(`❌ Errore creazione sottocategoria: ${createResult.error}`);
          return;
        }
      }
      
      // Sposta i prodotti
      const result = await spostaProddottiCategoria(selectedProducts, targetCategory);
      if (result.success) {
        const isNewSubcategory = targetCategory.includes(' > ') && !categorieFlat.some(cat => cat.nome === targetCategory);
        alert(`✅ ${isNewSubcategory ? 'Sottocategoria creata e ' : ''}${result.message}`);
        await loadCategorie();
        if (selectedCategory) {
          await loadProdotti(selectedCategory);
        }
        setSelectedProducts([]);
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert("❌ Errore durante lo spostamento");
    }
  };

  const handleMergeCategories = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    
    try {
      const result = await unisciCategorie(mergeSource, mergeTarget);
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        setShowMergeModal(false);
        setMergeSource("");
        setMergeTarget("");
        if (selectedCategory === mergeSource) {
          setSelectedCategory(null);
          setProdotti([]);
        }
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert("❌ Errore durante l'unione");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const result = await creaCategoria(newCategoryName.trim());
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        setShowCreateModal(false);
        setNewCategoryName("");
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert("❌ Errore durante la creazione");
    }
  };

  const handleCreateSubcategory = async () => {
    if (!newSubcategoryName.trim() || !selectedParentCategory) return;
    
    try {
      const result = await creaSottocategoria(selectedParentCategory, newSubcategoryName.trim());
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        setShowCreateSubModal(false);
        setNewSubcategoryName("");
        setSelectedParentCategory("");
        // Espandi la categoria padre per mostrare la nuova sottocategoria
        setExpandedCategories(prev => new Set([...prev, selectedParentCategory]));
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert("❌ Errore durante la creazione della sottocategoria");
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la categoria "${categoryName}"?`)) return;
    
    try {
      const result = await eliminaCategoria(categoryName);
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        if (selectedCategory === categoryName) {
          setSelectedCategory(null);
          setProdotti([]);
        }
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert("❌ Errore durante l'eliminazione");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !newName.trim()) {
      setEditingCategory(null);
      setNewName("");
      return;
    }
    
    // Determina il nuovo nome completo per i prodotti
    let newFullName: string;
    let oldProductCategory: string;
    
    if (editingCategory.includes(' > ')) {
      // È una sottocategoria - ricostruisci il path
      const parts = editingCategory.split(' > ');
      if (newName.trim() === parts[1]) {
        // Nome non cambiato
        setEditingCategory(null);
        setNewName("");
        return;
      }
      newFullName = `${parts[0]} > ${newName.trim()}`;
      oldProductCategory = editingCategory; // Usa il path completo per i prodotti
    } else {
      // È una categoria principale
      if (newName.trim() === editingCategory) {
        // Nome non cambiato
        setEditingCategory(null);
        setNewName("");
        return;
      }
      newFullName = newName.trim();
      oldProductCategory = editingCategory; // Usa il nome principale
    }
    
    try {
      const result = await rinominaCategoriaImproved(oldProductCategory, newFullName);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        // Se stiamo visualizzando la categoria rinominata, aggiorna la selezione
        if (selectedCategory === editingCategory) {
          setSelectedCategory(newFullName);
          await loadProdotti(newFullName);
        }
      } else {
        alert(`❌ ${result.error}`);
      }
      
    } catch (error) {
      console.error("Errore durante la modifica:", error);
      alert("❌ Errore durante la modifica del nome");
    } finally {
      setEditingCategory(null);
      setNewName("");
    }
  };

  const getCategoryEmoji = (category: string) => {
    const icon = categoryIcons.find(i => i.categoryName === category);
    if (icon?.icon) {
      return icon.iconType === 'image' ? null : icon.icon;
    }
    const mainCategory = category.split(' > ')[0];
    const emojiMap: { [key: string]: string } = {
      'CAFFETTERIA': '☕',
      'BIBITE': '🥤',
      'BIRRE': '🍺',
      'ALCOLICI': '🍸',
      'APERITIVI': '🍹',
      'COCKTAIL': '🍹',
      'DISTILLATI': '🥃',
      'VINI': '🍷',
      'PANINI': '🥪',
      'GELATI': '🍦'
    };
    return emojiMap[mainCategory] || '🍽️';
  };

  const getCategoryIcon = (category: string) => {
    return categoryIcons.find(i => i.categoryName === category);
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, categoryName: string) => {
    setDraggedItem(categoryName);
    e.dataTransfer.setData('text/plain', categoryName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    setDraggedOver(targetCategory);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Solo reset se stiamo lasciando il container principale
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggedOver(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    
    // Controlla se stiamo trascinando un prodotto
    const productData = e.dataTransfer.getData('application/product');
    if (productData) {
      await handleCategoryDropProduct(e, targetCategory);
      return;
    }
    
    // Altrimenti è una categoria
    const sourceCategory = e.dataTransfer.getData('text/plain');
    
    setDraggedItem(null);
    setDraggedOver(null);

    if (sourceCategory === targetCategory) return;

    // Non permettere di droppare una categoria padre in una sua sottocategoria
    if (targetCategory.startsWith(sourceCategory + ' > ')) {
      alert('❌ Non puoi spostare una categoria in una sua sottocategoria');
      return;
    }

    try {
      // Se stiamo droppando su una categoria principale, crea una sottocategoria
      const newName = targetCategory.includes(' > ') 
        ? targetCategory // Se droppiamo su una sottocategoria, mantieni la struttura
        : `${targetCategory} > ${sourceCategory.split(' > ').pop()}`; // Crea sottocategoria

      // Sposta tutti i prodotti dalla categoria sorgente alla nuova posizione
      const prodotti = await getProdottiByCategoria(sourceCategory);
      if (prodotti.length > 0) {
        const result = await spostaProddottiCategoria(
          prodotti.map(p => p.id), 
          newName
        );
        
        if (result.success) {
          alert(`✅ ${result.message}`);
          await loadCategorie();
          if (selectedCategory === sourceCategory) {
            setSelectedCategory(newName);
            await loadProdotti(newName);
          }
        } else {
          alert(`❌ ${result.error}`);
        }
      } else {
        // Se non ci sono prodotti, rinomina la categoria placeholder
        const result = await rinominaCategoria(sourceCategory, newName);
        if (result.success) {
          alert(`✅ Categoria spostata in ${newName}`);
          await loadCategorie();
        } else {
          alert(`❌ ${result.error}`);
        }
      }
    } catch (error) {
      alert('❌ Errore durante lo spostamento della categoria');
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedOver(null);
    
    // Solo se non stiamo trascinando un prodotto
    if (!isDraggingProduct) {
      setDraggedProduct(null);
      setIsDraggingProduct(false);
    }
  };

  // Drag & Drop handlers per prodotti
  const handleProductDragStart = (e: React.DragEvent, product: Product) => {
    setDraggedProduct(product);
    setIsDraggingProduct(true);
    e.dataTransfer.setData('application/product', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'move';
    
    // Aggiungi effetti visivi
    const element = e.currentTarget as HTMLElement;
    element.style.opacity = '0.6';
    element.style.transform = 'scale(0.95)';
  };

  // Auto-apertura categoria durante hover del prodotto
  const handleProductDragEnter = (e: React.DragEvent, categoryName: string) => {
    e.preventDefault();
    if (isDraggingProduct && draggedProduct) {
      setDraggedOver(categoryName);
      
      // Auto-apri categoria se è chiusa
      if (!expandedCategories.has(categoryName)) {
        setTimeout(() => {
          setExpandedCategories(prev => new Set([...prev, categoryName]));
        }, 800); // Ritardo per evitare aperture accidentali
      }
      
      // Removed auto-loading of products to prevent unwanted category switching
    }
  };

  const handleProductDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggedOver(null);
    }
  };

  const handleProductDragEnd = () => {
    setDraggedProduct(null);
    setIsDraggingProduct(false);
    setDraggedOver(null);
    
    // Rimuovi effetti visivi da tutti i prodotti
    document.querySelectorAll('[data-product-draggable]').forEach(el => {
      const element = el as HTMLElement;
      element.style.opacity = '';
      element.style.transform = '';
    });
  };

  const handleCategoryDropProduct = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const productData = e.dataTransfer.getData('application/product');
    if (!productData) return;

    try {
      const product = JSON.parse(productData);
      
      // Non fare nulla se il prodotto è già nella categoria target
      if (product.categoria === targetCategory) {
        setDraggedProduct(null);
        setIsDraggingProduct(false);
        setDraggedOver(null);
        return;
      }

      // Controlla se la categoria target è una nuova sottocategoria da creare
      if (targetCategory.includes(' > ') && !categorieFlat.some(cat => cat.nome === targetCategory)) {
        const [parentCategory, subcategoryName] = targetCategory.split(' > ');
        
        // Crea la sottocategoria prima
        const createResult = await creaCategoria(subcategoryName, parentCategory);
        if (!createResult.success) {
          alert(`❌ Errore creazione sottocategoria: ${createResult.error}`);
          return;
        }
      }

      // Sposta il prodotto
      const result = await spostaProddottiCategoria([product.id], targetCategory);
      
      if (result.success) {
        const isNewSubcategory = targetCategory.includes(' > ') && !categorieFlat.some(cat => cat.nome === targetCategory);
        alert(`✅ ${isNewSubcategory ? 'Sottocategoria creata e ' : ''}Prodotto "${product.nome}" spostato in "${targetCategory}"`);
        
        // Ricarica i dati
        await loadCategorie();
        if (selectedCategory) {
          await loadProdotti(selectedCategory);
        }
        if (globalSelectionMode) {
          await loadAllProdotti();
        }
      } else {
        alert(`❌ Errore spostamento prodotto: ${result.error}`);
      }
    } catch (error) {
      console.error('Errore durante lo spostamento del prodotto:', error);
      alert('❌ Errore durante lo spostamento del prodotto');
    } finally {
      setDraggedProduct(null);
      setIsDraggingProduct(false);
      setDraggedOver(null);
    }
  };

  // Funzioni per selezione globale
  const toggleGlobalSelectionMode = async () => {
    const newMode = !globalSelectionMode;
    setGlobalSelectionMode(newMode);
    
    if (newMode) {
      // Entrando in modalità globale, carica tutti i prodotti
      await loadAllProdotti();
    } else {
      // Uscendo dalla modalità globale, pulisci la selezione
      setGlobalSelectedProducts([]);
      setProdotti([]);
      setSelectedCategory(null);
    }
  };

  const toggleGlobalProductSelection = (product: Product) => {
    setGlobalSelectedProducts(prev => {
      const isSelected = prev.some(p => p.id === product.id);
      if (isSelected) {
        return prev.filter(p => p.id !== product.id);
      } else {
        return [...prev, {
          id: product.id,
          nome: product.nome,
          categoria: product.categoria
        }];
      }
    });
  };

  const handleBatchMoveToSubcategory = async (targetCategory: string) => {
    if (globalSelectedProducts.length === 0) return;
    
    try {
      const result = await spostaProddottiCategoria(
        globalSelectedProducts.map(p => p.id), 
        targetCategory
      );
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        await loadCategorie();
        setGlobalSelectedProducts([]);
        setShowMoveToSubcategoryModal(false);
        if (selectedCategory) {
          await loadProdotti(selectedCategory);
        }
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      alert('❌ Errore durante lo spostamento dei prodotti');
    }
  };

  const handleCreateAndMoveToSubcategory = async (parentCategory: string, subcategoryName: string) => {
    if (selectedProducts.length === 0) return;
    
    try {
      // Prima crea la sottocategoria
      const newSubcategoryPath = `${parentCategory} > ${subcategoryName}`;
      const createResult = await creaCategoria(subcategoryName, parentCategory);
      
      if (!createResult.success) {
        alert(`❌ ${createResult.error}`);
        return;
      }
      
      // Poi sposta i prodotti nella nuova sottocategoria
      const moveResult = await spostaProddottiCategoria(selectedProducts, newSubcategoryPath);
      
      if (moveResult.success) {
        alert(`✅ Sottocategoria "${subcategoryName}" creata e ${moveResult.count} prodotti spostati!`);
        await loadCategorie();
        await loadProdotti(parentCategory); // Ricarica la categoria principale
        setSelectedProducts([]);
      } else {
        alert(`❌ Sottocategoria creata ma errore nello spostamento: ${moveResult.error}`);
      }
    } catch (error) {
      alert('❌ Errore durante la creazione e spostamento');
    }
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct || !newProductName.trim()) {
      setEditingProduct(null);
      setNewProductName("");
      return;
    }
    
    try {
      const result = await rinominaProdotto(editingProduct, newProductName.trim());
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        // Ricarica i prodotti della categoria corrente
        if (selectedCategory) {
          await loadProdotti(selectedCategory);
        }
        if (globalSelectionMode) {
          await loadAllProdotti();
        }
      } else {
        alert(`❌ ${result.error}`);
      }
      
    } catch (error) {
      console.error("Errore durante la modifica del prodotto:", error);
      alert("❌ Errore durante la modifica del nome prodotto");
    } finally {
      setEditingProduct(null);
      setNewProductName("");
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const result = await exportProductsCSV();
      
      if (!result.success) {
        alert(`❌ ${result.error}`);
        return;
      }

      // Create blob and download using Server Action result
      if (!result.csvContent || !result.contentType || !result.fileName) {
        alert('❌ Dati di export non validi');
        return;
      }
      const blob = new Blob([result.csvContent], { type: result.contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('❌ Errore durante il download del file CSV');
    }
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      alert('❌ Seleziona un file CSV da importare');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const result = await importProductsCSV(formData);

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      if ('updated' in result && 'created' in result && 'errors' in result && 'errorDetails' in result) {
        setImportResult({
          success: result.success,
          updated: result.updated as number,
          created: result.created as number,
          errors: result.errors as number,
          errorDetails: result.errorDetails as string[]
        });
      }
      
      // Reload categories if import was successful
      if (result.success) {
        await loadCategorie();
        if (selectedCategory) {
          await loadProdotti(selectedCategory);
        }
        if (globalSelectionMode) {
          await loadAllProdotti();
        }
      }
    } catch (error: any) {
      alert(`❌ Errore durante l'importazione: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedProducts.length === 0) return;

    try {
      const updates: any = {};
      
      // Add only non-null values to updates
      if (bulkEditData.disponibile !== null) {
        updates.disponibile = bulkEditData.disponibile;
      }
      if (bulkEditData.terminato !== null) {
        updates.terminato = bulkEditData.terminato;
      }
      if (bulkEditData.categoria !== null) {
        updates.categoria = bulkEditData.categoria;
      }
      
      const result = await bulkUpdateProductsWithPriceAdjustment(
        selectedProducts,
        updates,
        bulkEditData.priceAdjustment || undefined
      );
      
      if (result.success) {
        alert(`✅ Aggiornati ${result.successCount} prodotti${result.errorCount && result.errorCount > 0 ? `, ${result.errorCount} errori` : ''}`);
        
        // Reload data
        await loadCategorie();
        if (selectedCategory) {
          await loadProdotti(selectedCategory);
        }
        if (globalSelectionMode) {
          await loadAllProdotti();
        }
        
        // Reset
        setSelectedProducts([]);
        setShowBulkEditModal(false);
        setBulkEditData({
          disponibile: null,
          terminato: null,
          categoria: null,
          priceAdjustment: null
        });
      } else {
        alert(`❌ ${result.error}`);
      }
      
    } catch (error) {
      alert('❌ Errore durante la modifica in blocco');
    }
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen p-6">
      
      {/* Create Category Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>Crea Nuova Categoria Principale</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Nome Categoria
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Es: APERITIVI, DISTILLATI, VINI..."
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory();
                    if (e.key === 'Escape') setShowCreateModal(false);
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border.secondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              >
                Annulla
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.button.success, color: colors.button.successText }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
              >
                Crea Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Subcategory Modal */}
      {showCreateSubModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>Crea Sottocategoria</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Categoria Principale
                </label>
                <select
                  value={selectedParentCategory}
                  onChange={(e) => setSelectedParentCategory(e.target.value)}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                >
                  <option value="">Seleziona categoria...</option>
                  {categorieGerarchiche.map((cat) => (
                    <option key={cat.nome} value={cat.nome}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Nome Sottocategoria
                </label>
                <input
                  type="text"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Es: Gin, Whisky, Vodka..."
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubcategory();
                    if (e.key === 'Escape') setShowCreateSubModal(false);
                  }}
                />
              </div>
              {selectedParentCategory && (
                <div className="text-sm p-3 rounded" style={{ backgroundColor: colors.bg.darker, color: colors.text.muted }}>
                  Sarà creata: <span style={{ color: colors.text.secondary }}>{selectedParentCategory} &gt; {newSubcategoryName}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateSubModal(false)}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border.secondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              >
                Annulla
              </button>
              <button
                onClick={handleCreateSubcategory}
                disabled={!newSubcategoryName.trim() || !selectedParentCategory}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.button.primary, color: colors.button.primaryText }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
              >
                Crea Sottocategoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Subcategory Modal */}
      {showMoveToSubcategoryModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>Sposta Prodotti Selezionati</h3>
            <div className="space-y-4">
              <div className="p-3 rounded max-h-40 overflow-y-auto" style={{ backgroundColor: colors.bg.darker }}>
                <h4 className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  {globalSelectedProducts.length} prodotti selezionati:
                </h4>
                {globalSelectedProducts.map((product) => (
                  <div key={product.id} className="text-xs" style={{ color: colors.text.muted }}>
                    • {product.nome} (da {product.categoria})
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Categoria di destinazione
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchMoveToSubcategory(e.target.value);
                    }
                  }}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  defaultValue=""
                >
                  <option value="">Seleziona categoria...</option>
                  {categorieFlat.map((cat) => (
                    <option key={cat.nome} value={cat.nome}>
                      {cat.nome} ({cat.prodottiCount} prodotti)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMoveToSubcategoryModal(false)}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border.secondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>Unisci Categorie</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Categoria da unire (scomparirà)
                </label>
                <select
                  value={mergeSource}
                  onChange={(e) => setMergeSource(e.target.value)}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                >
                  <option value="">Seleziona categoria</option>
                  {categorieFlat.map((cat) => (
                    <option key={cat.nome} value={cat.nome}>
                      {cat.nome} ({cat.prodottiCount} prodotti)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Categoria di destinazione
                </label>
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                >
                  <option value="">Seleziona categoria</option>
                  {categorieFlat.filter(cat => cat.nome !== mergeSource).map((cat) => (
                    <option key={cat.nome} value={cat.nome}>
                      {cat.nome} ({cat.prodottiCount} prodotti)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMergeModal(false)}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border.secondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              >
                Annulla
              </button>
              <button
                onClick={handleMergeCategories}
                disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.text.error, color: 'white' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Unisci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Settings Modal */}
      {showCategorySettingsModal && selectedCategoryForSettings && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-2xl font-bold mb-6" style={{ color: colors.text.primary }}>Impostazioni Categoria</h3>
            
            <div className="space-y-6">
              {/* Nome Categoria */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Nome Categoria
                </label>
                <input
                  type="text"
                  value={categorySettingsForm.name}
                  onChange={(e) => setCategorySettingsForm({...categorySettingsForm, name: e.target.value})}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                />
              </div>

              {/* Icona Section */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                  Icona Categoria
                </label>
                
                {/* Current Icon Display */}
                <div className="flex items-center justify-center mb-4 p-4 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                  {categorySettingsForm.iconType === 'image' && categorySettingsForm.icon?.startsWith('/') ? (
                    <img 
                      src={categorySettingsForm.icon} 
                      alt="Icona categoria"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-5xl">{categorySettingsForm.icon || '🍽️'}</span>
                  )}
                </div>

                {/* Icon Type Tabs */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setCategorySettingsForm({...categorySettingsForm, iconType: 'emoji'})}
                    className={`flex-1 p-2 rounded-lg transition-colors ${
                      categorySettingsForm.iconType === 'emoji' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Emoji
                  </button>
                  <button
                    onClick={() => setCategorySettingsForm({...categorySettingsForm, iconType: 'image'})}
                    className={`flex-1 p-2 rounded-lg transition-colors ${
                      categorySettingsForm.iconType === 'image' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Immagine
                  </button>
                </div>

                {/* Emoji Input */}
                {categorySettingsForm.iconType === 'emoji' && (
                  <div>
                    <input
                      type="text"
                      value={categorySettingsForm.icon}
                      onChange={(e) => setCategorySettingsForm({...categorySettingsForm, icon: e.target.value})}
                      placeholder="Inserisci emoji"
                      className="w-full p-3 rounded-lg text-2xl text-center mb-3"
                      style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                    />
                    
                    {/* Emoji suggerite */}
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-sm" style={{ color: colors.text.muted }}>Suggerite:</span>
                      {['☕', '🍺', '🍹', '🥃', '🍷', '🥤', '🥪', '🍦', '🍰', '🍕', '🍔', '🌮', '🥗', '🍝', '🍜'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setCategorySettingsForm({...categorySettingsForm, icon: emoji})}
                          className="text-2xl hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Upload */}
                {categorySettingsForm.iconType === 'image' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="category-icon-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && selectedCategoryForSettings) {
                          setUploadingIcon(selectedCategoryForSettings);
                          
                          const formData = new FormData();
                          formData.append('icon', file);
                          
                          try {
                            const response = await fetch(`/api/dashboard/category-icons/${encodeURIComponent(selectedCategoryForSettings)}/upload`, {
                              method: 'POST',
                              body: formData
                            });

                            if (response.ok) {
                              const data = await response.json();
                              setCategorySettingsForm({...categorySettingsForm, icon: data.iconUrl, iconType: 'image'});
                              toast.success('Immagine caricata con successo');
                              await loadCategoryIcons();
                            } else {
                              const error = await response.json();
                              toast.error(error.error || 'Errore nel caricamento');
                            }
                          } catch (error) {
                            toast.error('Errore nel caricamento dell\'immagine');
                          } finally {
                            setUploadingIcon(null);
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('category-icon-upload')?.click()}
                      className="w-full p-3 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
                      style={{ backgroundColor: colors.button.primary, color: colors.button.primaryText }}
                      disabled={uploadingIcon === selectedCategoryForSettings}
                    >
                      {uploadingIcon === selectedCategoryForSettings ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          Caricamento...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          Carica Immagine
                        </>
                      )}
                    </button>
                    <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
                      Formati supportati: PNG, JPG, GIF (max 2MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Colore */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Colore Tema
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={categorySettingsForm.color}
                    onChange={(e) => setCategorySettingsForm({...categorySettingsForm, color: e.target.value})}
                    className="h-12 w-20 rounded-lg cursor-pointer"
                    style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary }}
                  />
                  <input
                    type="text"
                    value={categorySettingsForm.color}
                    onChange={(e) => setCategorySettingsForm({...categorySettingsForm, color: e.target.value})}
                    placeholder="#000000"
                    className="flex-1 p-3 rounded-lg"
                    style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-6" style={{ borderTop: `1px solid ${colors.border.primary}` }}>
              <button
                onClick={() => {
                  setShowCategorySettingsModal(false);
                  setSelectedCategoryForSettings(null);
                }}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  if (selectedCategoryForSettings !== categorySettingsForm.name) {
                    // Rinomina categoria
                    const result = await rinominaCategoria(selectedCategoryForSettings, categorySettingsForm.name);
                    if (!result.success) {
                      toast.error(result.error || 'Errore rinomina');
                      return;
                    }
                  }
                  
                  // Salva icona e colore
                  const response = await fetch('/api/dashboard/category-icons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      categoryName: categorySettingsForm.name,
                      icon: categorySettingsForm.icon,
                      iconType: categorySettingsForm.iconType,
                      color: categorySettingsForm.color
                    })
                  });
                  
                  if (response.ok) {
                    toast.success('Impostazioni salvate');
                    await loadCategorie();
                    await loadCategoryIcons();
                    setShowCategorySettingsModal(false);
                    setSelectedCategoryForSettings(null);
                    if (selectedCategory === selectedCategoryForSettings) {
                      setSelectedCategory(categorySettingsForm.name);
                    }
                  } else {
                    toast.error('Errore salvataggio');
                  }
                }}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.button.success, color: colors.button.successText }}
              >
                Salva Modifiche
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Sei sicuro di voler eliminare la categoria "${selectedCategoryForSettings}"?\n\nTutti i prodotti verranno spostati in "Non categorizzato".`)) {
                    const result = await eliminaCategoria(selectedCategoryForSettings);
                    if (result.success) {
                      toast.success('Categoria eliminata');
                      await loadCategorie();
                      await loadCategoryIcons();
                      setShowCategorySettingsModal(false);
                      setSelectedCategoryForSettings(null);
                      if (selectedCategory === selectedCategoryForSettings) {
                        setSelectedCategory(null);
                        setProdotti([]);
                      }
                    } else {
                      toast.error(result.error || 'Errore eliminazione');
                    }
                  }
                }}
                className="p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.text.error, color: 'white' }}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>Importa Prodotti da CSV</h3>
            
            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                    Seleziona file CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full p-3 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold"
                    style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  />
                </div>
                
                {importFile && (
                  <div className="p-3 rounded text-sm" style={{ backgroundColor: colors.bg.darker, color: colors.text.muted }}>
                    📄 {importFile.name}
                  </div>
                )}
                
                <div className="text-xs space-y-1" style={{ color: colors.text.muted }}>
                  <p>⚠️ Note importanti:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Il file deve essere in formato CSV</li>
                    <li>La prima riga deve contenere i nomi delle colonne</li>
                    <li>I prodotti esistenti verranno aggiornati</li>
                    <li>I nuovi prodotti verranno creati</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded" style={{ backgroundColor: `${colors.button.success}20`, borderColor: colors.border.success, borderWidth: '1px', borderStyle: 'solid' }}>
                  <h4 className="font-semibold mb-2" style={{ color: colors.text.success }}>✅ Importazione completata!</h4>
                  <div className="space-y-1 text-sm">
                    <p>📝 Aggiornati: <span className="font-bold">{importResult.updated}</span> prodotti</p>
                    <p>🆕 Creati: <span className="font-bold">{importResult.created}</span> prodotti</p>
                    {importResult.errors > 0 && (
                      <p>❌ Errori: <span className="font-bold" style={{ color: colors.text.error }}>{importResult.errors}</span></p>
                    )}
                  </div>
                </div>
                
                {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                  <div className="p-3 rounded max-h-40 overflow-y-auto" style={{ backgroundColor: `${colors.text.error}20`, borderColor: colors.border.error, borderWidth: '1px', borderStyle: 'solid' }}>
                    <h5 className="text-sm font-semibold mb-1" style={{ color: colors.text.error }}>Dettagli errori:</h5>
                    <ul className="text-xs text-red-300 space-y-1">
                      {importResult.errorDetails.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              {!importResult ? (
                <>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border.secondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                    disabled={isImporting}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleImportCSV}
                    disabled={!importFile || isImporting}
                    className="flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
                    style={{ backgroundColor: colors.button.success, color: colors.button.successText }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
                  >
                    {isImporting ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Importa
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className="w-full p-3 rounded-lg transition-colors duration-200"
                  style={{ backgroundColor: colors.button.primary, color: colors.button.primaryText }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
                >
                  Chiudi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-full max-w-md" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
              Modifica {selectedProducts.length} Prodotti
            </h3>
            
            <div className="space-y-4">
              {/* Availability Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Disponibilità
                </label>
                <select
                  value={bulkEditData.disponibile === null ? '' : bulkEditData.disponibile.toString()}
                  onChange={(e) => setBulkEditData(prev => ({
                    ...prev,
                    disponibile: e.target.value === '' ? null : e.target.value === 'true'
                  }))}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                >
                  <option value="">Non modificare</option>
                  <option value="true">Disponibile</option>
                  <option value="false">Non disponibile</option>
                </select>
              </div>
              
              {/* Terminated Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Stato Terminato
                </label>
                <select
                  value={bulkEditData.terminato === null ? '' : bulkEditData.terminato.toString()}
                  onChange={(e) => setBulkEditData(prev => ({
                    ...prev,
                    terminato: e.target.value === '' ? null : e.target.value === 'true'
                  }))}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                >
                  <option value="">Non modificare</option>
                  <option value="true">Terminato</option>
                  <option value="false">Non terminato</option>
                </select>
              </div>
              
              {/* Category Change */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Sposta in Categoria
                </label>
                <select
                  value={bulkEditData.categoria || ''}
                  onChange={(e) => setBulkEditData(prev => ({
                    ...prev,
                    categoria: e.target.value || null
                  }))}
                  className="w-full p-3 rounded-lg"
                  style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                >
                  <option value="">Non modificare</option>
                  {categorieFlat.map((cat) => (
                    <option key={cat.nome} value={cat.nome}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Price Adjustment */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Modifica Prezzo
                </label>
                <div className="flex gap-2">
                  <select
                    value={bulkEditData.priceAdjustment?.type || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setBulkEditData(prev => ({
                          ...prev,
                          priceAdjustment: {
                            type: e.target.value as 'fixed' | 'percentage',
                            value: prev.priceAdjustment?.value || 0
                          }
                        }));
                      } else {
                        setBulkEditData(prev => ({
                          ...prev,
                          priceAdjustment: null
                        }));
                      }
                    }}
                    className="flex-1 p-3 rounded-lg"
                    style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  >
                    <option value="">Non modificare</option>
                    <option value="fixed">Importo fisso (€)</option>
                    <option value="percentage">Percentuale (%)</option>
                  </select>
                  
                  {bulkEditData.priceAdjustment && (
                    <input
                      type="number"
                      step="0.01"
                      value={bulkEditData.priceAdjustment.value}
                      onChange={(e) => setBulkEditData(prev => ({
                        ...prev,
                        priceAdjustment: prev.priceAdjustment ? {
                          ...prev.priceAdjustment,
                          value: Number(e.target.value)
                        } : null
                      }))}
                      placeholder={bulkEditData.priceAdjustment.type === 'percentage' ? '10' : '2.50'}
                      className="w-32 p-3 rounded-lg"
                      style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
                    />
                  )}
                </div>
                {bulkEditData.priceAdjustment && (
                  <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                    {bulkEditData.priceAdjustment.type === 'fixed' 
                      ? `${bulkEditData.priceAdjustment.value >= 0 ? 'Aumenta' : 'Diminuisce'} di €${Math.abs(bulkEditData.priceAdjustment.value)}`
                      : `${bulkEditData.priceAdjustment.value >= 0 ? 'Aumenta' : 'Diminuisce'} del ${Math.abs(bulkEditData.priceAdjustment.value)}%`
                    }
                  </p>
                )}
              </div>
              
              {/* Summary */}
              <div className="p-3 rounded text-sm" style={{ backgroundColor: colors.bg.darker, color: colors.text.muted }}>
                <p className="font-semibold mb-1">Riepilogo modifiche:</p>
                <ul className="space-y-1 text-xs">
                  {bulkEditData.disponibile !== null && (
                    <li>• Disponibilità → {bulkEditData.disponibile ? 'Disponibile' : 'Non disponibile'}</li>
                  )}
                  {bulkEditData.terminato !== null && (
                    <li>• Stato → {bulkEditData.terminato ? 'Terminato' : 'Non terminato'}</li>
                  )}
                  {bulkEditData.categoria && (
                    <li>• Categoria → {bulkEditData.categoria}</li>
                  )}
                  {bulkEditData.priceAdjustment && (
                    <li>• Prezzo → {
                      bulkEditData.priceAdjustment.type === 'fixed'
                        ? `${bulkEditData.priceAdjustment.value >= 0 ? '+' : ''}€${bulkEditData.priceAdjustment.value}`
                        : `${bulkEditData.priceAdjustment.value >= 0 ? '+' : ''}${bulkEditData.priceAdjustment.value}%`
                    }</li>
                  )}
                </ul>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkEditModal(false);
                  setBulkEditData({
                    disponibile: null,
                    terminato: null,
                    categoria: null,
                    priceAdjustment: null
                  });
                }}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border.secondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              >
                Annulla
              </button>
              <button
                onClick={handleBulkEdit}
                className="flex-1 p-3 rounded-lg transition-colors duration-200"
                style={{ backgroundColor: '#9333ea', color: 'white' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
              >
                Applica Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard" className="p-2 rounded-lg transition-colors"
            style={{ color: colors.text.secondary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>Gestione Categorie</h1>
            <p style={{ color: colors.text.muted }}>Organizza categorie e sottocategorie dei prodotti</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ backgroundColor: colors.button.success, color: colors.button.successText }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
          >
            <Plus className="h-4 w-4" />
            Nuova Categoria
          </button>
          <button
            onClick={() => setShowCreateSubModal(true)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ backgroundColor: colors.button.primary, color: colors.button.primaryText }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
          >
            <Plus className="h-4 w-4" />
            Nuova Sottocategoria
          </button>
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ backgroundColor: '#ea580c', color: 'white' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c2410c'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
          >
            <Merge className="h-4 w-4" />
            Unisci Categorie
          </button>
          <button
            onClick={toggleGlobalSelectionMode}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              globalSelectionMode 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            <Package className="h-4 w-4" />
            {globalSelectionMode ? 'Esci Selezione' : 'Selezione Globale'}
          </button>
          {globalSelectedProducts.length > 0 && (
            <button
              onClick={() => setShowMoveToSubcategoryModal(true)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ backgroundColor: colors.button.success, color: colors.button.successText }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
            >
              <Save className="h-4 w-4" />
              Sposta {globalSelectedProducts.length} Prodotti
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ backgroundColor: '#059669', color: 'white' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#047857'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            title="Importa prodotti da file CSV"
          >
            <Upload className="h-4 w-4" />
            Importa Excel
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
            style={{ backgroundColor: '#4f46e5', color: 'white' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
            title="Scarica tutti i prodotti in formato CSV per Excel"
          >
            <Download className="h-4 w-4" />
            Esporta Excel
          </button>
        </div>
        
      </div>

      {/* Categories as Horizontal Tabs */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text.primary }}>
          <Tag className="h-5 w-5" />
          Categorie
        </h2>
        <div className="flex flex-wrap gap-2 p-4 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            {categorieGerarchiche.map((categoria) => (
              <button
                key={categoria.nome}
                onClick={() => {
                  setSelectedCategory(categoria.nome);
                  loadProdotti(categoria.nome);
                }}
                className="px-3 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-80 flex-shrink-0"
                style={{
                  backgroundColor: selectedCategory === categoria.nome ? colors.button.primary : colors.bg.hover,
                  color: selectedCategory === categoria.nome ? colors.button.primaryText : colors.text.primary,
                  border: `1px solid ${colors.border.primary}`
                }}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const icon = getCategoryIcon(categoria.nome);
                    if (icon?.icon && icon.iconType === 'image') {
                      return (
                        <img 
                          src={icon.icon} 
                          alt={categoria.nome}
                          className="w-4 h-4 object-cover rounded"
                        />
                      );
                    }
                    return <span className="text-sm">{getCategoryEmoji(categoria.nome)}</span>;
                  })()}
                  <span className="text-sm">{categoria.nome}</span>
                  <span className="text-xs" style={{ color: selectedCategory === categoria.nome ? colors.button.primaryText : colors.text.muted }}>
                    ({categoria.prodottiCount})
                  </span>
                  {/* Settings button for selected category */}
                  {selectedCategory === categoria.nome && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const icon = getCategoryIcon(categoria.nome);
                        setSelectedCategoryForSettings(categoria.nome);
                        setCategorySettingsForm({
                          name: categoria.nome,
                          icon: icon?.icon || getCategoryEmoji(categoria.nome) || '🍽️',
                          iconType: icon?.iconType || 'emoji',
                          color: icon?.color || '#000000'
                        });
                        setShowCategorySettingsModal(true);
                      }}
                      className="ml-2 p-1 rounded hover:bg-black/10 transition-colors"
                      title="Impostazioni categoria"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column - Products in Selected Category */}
        <div className="rounded-lg p-6" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
              <Package className="h-5 w-5" />
              {selectedCategory ? `Prodotti in "${selectedCategory}"` : "Seleziona una categoria"}
            </h2>
            {selectedCategory && prodotti.length > 0 && (
              <div className="text-sm" style={{ color: colors.text.muted }}>
                {filteredProdotti.length} di {prodotti.length} prodotti
              </div>
            )}
          </div>
          
          {/* Search and Filter Bar */}
          {selectedCategory && prodotti.length > 0 && (
            <div className="mb-4 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: colors.text.muted }} />
                <input
                  type="text"
                  placeholder="Cerca prodotti..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: colors.border.primary,
                    color: colors.text.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Products List */}
          {!selectedCategory ? (
            <div className="text-center py-12" style={{ color: colors.text.muted }}>
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Seleziona una categoria dai tab sopra per vedere i prodotti</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12" style={{ color: colors.text.muted }}>
              <p>Caricamento prodotti...</p>
            </div>
          ) : prodotti.length === 0 ? (
            <div className="text-center py-12" style={{ color: colors.text.muted }}>
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Nessun prodotto in questa categoria</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProdotti.map((prodotto) => (
                <div
                  key={prodotto.id}
                  draggable
                  data-product-draggable
                  onDragStart={(e) => handleProductDragStart(e, prodotto)}
                  onDragEnd={handleProductDragEnd}
                  className="flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-move hover:shadow-lg"
                  style={{
                    backgroundColor: colors.bg.hover,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="cursor-move opacity-50 hover:opacity-100 transition-opacity">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 4.5C7 5.32843 6.32843 6 5.5 6C4.67157 6 4 5.32843 4 4.5C4 3.67157 4.67157 3 5.5 3C6.32843 3 7 3.67157 7 4.5Z" fill="currentColor"/>
                        <path d="M7 10C7 10.8284 6.32843 11.5 5.5 11.5C4.67157 11.5 4 10.8284 4 10C4 9.17157 4.67157 8.5 5.5 8.5C6.32843 8.5 7 9.17157 7 10Z" fill="currentColor"/>
                        <path d="M5.5 17C6.32843 17 7 16.3284 7 15.5C7 14.6716 6.32843 14 5.5 14C4.67157 14 4 14.6716 4 15.5C4 16.3284 4.67157 17 5.5 17Z" fill="currentColor"/>
                        <path d="M16 4.5C16 5.32843 15.3284 6 14.5 6C13.6716 6 13 5.32843 13 4.5C13 3.67157 13.6716 3 14.5 3C15.3284 3 16 3.67157 16 4.5Z" fill="currentColor"/>
                        <path d="M14.5 11.5C15.3284 11.5 16 10.8284 16 10C16 9.17157 15.3284 8.5 14.5 8.5C13.6716 8.5 13 9.17157 13 10C13 10.8284 13.6716 11.5 14.5 11.5Z" fill="currentColor"/>
                        <path d="M16 15.5C16 16.3284 15.3284 17 14.5 17C13.6716 17 13 16.3284 13 15.5C13 14.6716 13.6716 14 14.5 14C15.3284 14 16 14.6716 16 15.5Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium" style={{ color: colors.text.primary }}>
                        {prodotto.nome}
                      </div>
                      <div className="text-sm" style={{ color: colors.text.muted }}>
                        €{prodotto.prezzo.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded" style={{
                      backgroundColor: prodotto.disponibile ? colors.button.success : colors.text.error,
                      color: 'white'
                    }}>
                      {prodotto.disponibile ? 'Disponibile' : 'Non disponibile'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Right Column - Quick Move */}
        <div className="rounded-lg p-6" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
              <Tag className="h-5 w-5" />
              Sposta Veloce
            </h2>
          </div>
          
          {/* Categories Grid for Quick Move */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2 relative" style={{ padding: '4px' }}>
            {categorieGerarchiche
              .filter(categoria => categoria.nome !== selectedCategory) // Exclude current category
              .map((categoria) => (
              <div
                key={categoria.nome}
                className="rounded-lg p-3 transition-all duration-200 hover:scale-105 cursor-pointer relative group"
                style={{
                  backgroundColor: isDraggingProduct && draggedOver === categoria.nome ? colors.button.primaryHover : colors.bg.hover,
                  borderColor: isDraggingProduct && draggedOver === categoria.nome ? colors.button.primary : colors.border.primary,
                  borderWidth: isDraggingProduct && draggedOver === categoria.nome ? '2px' : '1px',
                  borderStyle: 'solid',
                  minHeight: '90px',
                  zIndex: isDraggingProduct && draggedOver === categoria.nome ? 10 : 1,
                  position: 'relative'
                }}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleProductDragEnter(e, categoria.nome)}
                onDragLeave={handleProductDragLeave}
                onDrop={(e) => handleCategoryDropProduct(e, categoria.nome)}
              >
                {/* Drop indicator animation */}
                {isDraggingProduct && draggedOver === categoria.nome && (
                  <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
                    background: `linear-gradient(45deg, ${colors.button.primary}20 25%, transparent 25%, transparent 75%, ${colors.button.primary}20 75%, ${colors.button.primary}20)`,
                    backgroundSize: '20px 20px',
                    animation: 'move-bg 0.5s linear infinite'
                  }} />
                )}
                
                <div className="flex flex-col h-full justify-between relative z-10">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      {(() => {
                        const icon = getCategoryIcon(categoria.nome);
                        if (icon?.icon && icon.iconType === 'image') {
                          return (
                            <img 
                              src={icon.icon} 
                              alt={categoria.nome}
                              className="w-5 h-5 object-cover rounded"
                            />
                          );
                        }
                        return <span className="text-lg">{getCategoryEmoji(categoria.nome)}</span>;
                      })()}
                      <h3 className="font-semibold text-xs" style={{ color: colors.text.primary }}>
                        {categoria.nome}
                      </h3>
                    </div>
                    <div className="text-xs" style={{ color: colors.text.muted }}>
                      {categoria.prodottiCount} prod.
                    </div>
                  </div>
                  
                  {/* Drop zone indicator */}
                  {isDraggingProduct && draggedOver === categoria.nome && (
                    <div className="mt-1 text-xs text-center p-1 rounded" style={{
                      backgroundColor: colors.button.primary + '20',
                      color: colors.button.primary,
                      border: `1px dashed ${colors.button.primary}`,
                      fontSize: '10px'
                    }}>
                      📦 Rilascia qui
                    </div>
                  )}
                  
                  {/* Subcategories preview */}
                  {categoria.sottocategorie.length > 0 && (
                    <div className="mt-1 pt-1" style={{ borderTop: `1px solid ${colors.border.secondary}` }}>
                      <div className="text-xs" style={{ color: colors.text.muted, fontSize: '10px' }}>
                        {categoria.sottocategorie.length} sottoc.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Add CSS for animation */}
          <style jsx>{`
            @keyframes move-bg {
              0% {
                background-position: 0 0;
              }
              100% {
                background-position: 20px 20px;
              }
            }
          `}</style>
        </div>
      </div>
      
    </div>
    </AuthGuard>
  );
}
