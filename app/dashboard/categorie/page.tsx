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

  useEffect(() => {
    loadCategorie();
  }, []);

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
      
      // Auto-carica prodotti se non è già la categoria selezionata
      if (selectedCategory !== categoryName) {
        setTimeout(() => {
          if (draggedOver === categoryName) { // Verifica che siamo ancora sopra
            loadProdotti(categoryName);
            setSelectedCategory(categoryName);
          }
        }, 1000);
      }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      
      {/* Create Category Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-foreground mb-4">Crea Nuova Categoria Principale</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nome Categoria
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Es: APERITIVI, DISTILLATI, VINI..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="flex-1 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className="flex-1 p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg"
              >
                Crea Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Subcategory Modal */}
      {showCreateSubModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-foreground mb-4">Crea Sottocategoria</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoria Principale
                </label>
                <select
                  value={selectedParentCategory}
                  onChange={(e) => setSelectedParentCategory(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
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
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nome Sottocategoria
                </label>
                <input
                  type="text"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Es: Gin, Whisky, Vodka..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubcategory();
                    if (e.key === 'Escape') setShowCreateSubModal(false);
                  }}
                />
              </div>
              {selectedParentCategory && (
                <div className="text-sm text-muted-foreground bg-slate-900 p-3 rounded">
                  Sarà creata: <span className="text-white/70">{selectedParentCategory} &gt; {newSubcategoryName}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateSubModal(false)}
                className="flex-1 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateSubcategory}
                disabled={!newSubcategoryName.trim() || !selectedParentCategory}
                className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
              >
                Crea Sottocategoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Subcategory Modal */}
      {showMoveToSubcategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-foreground mb-4">Sposta Prodotti Selezionati</h3>
            <div className="space-y-4">
              <div className="bg-slate-900 p-3 rounded max-h-40 overflow-y-auto">
                <h4 className="text-sm font-medium text-white/70 mb-2">
                  {globalSelectedProducts.length} prodotti selezionati:
                </h4>
                {globalSelectedProducts.map((product) => (
                  <div key={product.id} className="text-xs text-muted-foreground">
                    • {product.nome} (da {product.categoria})
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoria di destinazione
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchMoveToSubcategory(e.target.value);
                    }
                  }}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
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
                className="flex-1 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-foreground mb-4">Unisci Categorie</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoria da unire (scomparirà)
                </label>
                <select
                  value={mergeSource}
                  onChange={(e) => setMergeSource(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
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
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoria di destinazione
                </label>
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
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
                className="flex-1 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleMergeCategories}
                disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
                className="flex-1 p-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg"
              >
                Unisci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-foreground mb-4">Importa Prodotti da CSV</h3>
            
            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Seleziona file CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/15 file:text-white hover:file:bg-white/20"
                  />
                </div>
                
                {importFile && (
                  <div className="bg-slate-900 p-3 rounded text-sm text-muted-foreground">
                    📄 {importFile.name}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground space-y-1">
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
                <div className="bg-green-900/20 border border-white/15-700 p-4 rounded">
                  <h4 className="text-white/60 font-semibold mb-2">✅ Importazione completata!</h4>
                  <div className="space-y-1 text-sm">
                    <p>📝 Aggiornati: <span className="font-bold">{importResult.updated}</span> prodotti</p>
                    <p>🆕 Creati: <span className="font-bold">{importResult.created}</span> prodotti</p>
                    {importResult.errors > 0 && (
                      <p>❌ Errori: <span className="font-bold text-white/50">{importResult.errors}</span></p>
                    )}
                  </div>
                </div>
                
                {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                  <div className="bg-red-900/20 border border-white/10-700 p-3 rounded max-h-40 overflow-y-auto">
                    <h5 className="text-white/50 text-sm font-semibold mb-1">Dettagli errori:</h5>
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
                    className="flex-1 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    disabled={isImporting}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleImportCSV}
                    disabled={!importFile || isImporting}
                    className="flex-1 p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2"
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
                  className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md">
            <h3 className="text-xl font-bold text-foreground mb-4">
              Modifica {selectedProducts.length} Prodotti
            </h3>
            
            <div className="space-y-4">
              {/* Availability Toggle */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Disponibilità
                </label>
                <select
                  value={bulkEditData.disponibile === null ? '' : bulkEditData.disponibile.toString()}
                  onChange={(e) => setBulkEditData(prev => ({
                    ...prev,
                    disponibile: e.target.value === '' ? null : e.target.value === 'true'
                  }))}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
                >
                  <option value="">Non modificare</option>
                  <option value="true">Disponibile</option>
                  <option value="false">Non disponibile</option>
                </select>
              </div>
              
              {/* Terminated Toggle */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Stato Terminato
                </label>
                <select
                  value={bulkEditData.terminato === null ? '' : bulkEditData.terminato.toString()}
                  onChange={(e) => setBulkEditData(prev => ({
                    ...prev,
                    terminato: e.target.value === '' ? null : e.target.value === 'true'
                  }))}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
                >
                  <option value="">Non modificare</option>
                  <option value="true">Terminato</option>
                  <option value="false">Non terminato</option>
                </select>
              </div>
              
              {/* Category Change */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Sposta in Categoria
                </label>
                <select
                  value={bulkEditData.categoria || ''}
                  onChange={(e) => setBulkEditData(prev => ({
                    ...prev,
                    categoria: e.target.value || null
                  }))}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
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
                <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                    className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
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
                      className="w-32 p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground"
                    />
                  )}
                </div>
                {bulkEditData.priceAdjustment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {bulkEditData.priceAdjustment.type === 'fixed' 
                      ? `${bulkEditData.priceAdjustment.value >= 0 ? 'Aumenta' : 'Diminuisce'} di €${Math.abs(bulkEditData.priceAdjustment.value)}`
                      : `${bulkEditData.priceAdjustment.value >= 0 ? 'Aumenta' : 'Diminuisce'} del ${Math.abs(bulkEditData.priceAdjustment.value)}%`
                    }
                  </p>
                )}
              </div>
              
              {/* Summary */}
              <div className="bg-slate-900 p-3 rounded text-sm text-muted-foreground">
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
                className="flex-1 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleBulkEdit}
                className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
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
          <Link href="/dashboard" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-white/70" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestione Categorie</h1>
            <p className="text-muted-foreground">Organizza categorie e sottocategorie dei prodotti</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuova Categoria
          </button>
          <button
            onClick={() => setShowCreateSubModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuova Sottocategoria
          </button>
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2"
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
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Sposta {globalSelectedProducts.length} Prodotti
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2"
            title="Importa prodotti da file CSV"
          >
            <Upload className="h-4 w-4" />
            Importa Excel
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
            title="Scarica tutti i prodotti in formato CSV per Excel"
          >
            <Download className="h-4 w-4" />
            Esporta Excel
          </button>
        </div>
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Hierarchical Categories List */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Categorie ({categorieGerarchiche.length})
            </h2>
            {draggedItem && (
              <div className="text-sm text-white/70 flex items-center gap-2 animate-pulse">
                <span>🖱️ Trascinando categoria "{draggedItem}" - Rilascia su una categoria per creare sottocategoria</span>
              </div>
            )}
            {isDraggingProduct && draggedProduct && (
              <div className="text-sm text-cyan-400 flex items-center gap-2 animate-pulse">
                <span>🛒 Trascinando prodotto "{draggedProduct.nome}" - Rilascia su una categoria per spostarlo</span>
              </div>
            )}
          </div>
          
          {/* Zona drop per nuove categorie principali */}
          {draggedItem && (
            <div 
              className={`mb-4 p-4 border-2 border-dashed rounded-lg transition-all ${
                draggedOver === 'root' 
                  ? 'border-white/15-500 bg-white/10/10' 
                  : 'border-slate-600 bg-slate-900/30'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, 'root')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.preventDefault();
                const sourceCategory = e.dataTransfer.getData('text/plain');
                // Trasforma in categoria principale
                const newName = sourceCategory.split(' > ').pop() || sourceCategory;
                handleDrop(e, newName);
              }}
            >
              <div className="text-center text-muted-foreground">
                🏠 Rilascia qui per creare una categoria principale
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Caricamento categorie...
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {categorieGerarchiche.map((categoria) => (
                <div key={categoria.nome} className="border border-slate-700 rounded-lg">
                  {/* Categoria Principale */}
                  <div 
                    className={`flex items-center justify-between p-4 bg-slate-900/50 transition-all duration-200 cursor-move border-2 border-transparent hover:border-white/20-400/50 ${
                      draggedOver === categoria.nome && isDraggingProduct 
                        ? 'bg-white/10/20 border-white/15-500 shadow-lg scale-102' 
                        : draggedOver === categoria.nome 
                        ? 'bg-white/15/20 border-white/20-500' 
                        : ''
                    } ${
                      draggedItem === categoria.nome ? 'opacity-50 scale-95' : ''
                    }`}
                    draggable={!isDraggingProduct}
                    onDragStart={(e) => !isDraggingProduct && handleDragStart(e, categoria.nome)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => {
                      if (isDraggingProduct) {
                        handleProductDragEnter(e, categoria.nome);
                      } else {
                        handleDragEnter(e, categoria.nome);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (isDraggingProduct) {
                        handleProductDragLeave(e);
                      } else {
                        handleDragLeave(e);
                      }
                    }}
                    onDrop={(e) => handleDrop(e, categoria.nome)}
                    onDragEnd={handleDragEnd}
                  >
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => loadProdotti(categoria.nome)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategory(categoria.nome);
                        }}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        {categoria.sottocategorie.length > 0 ? (
                          expandedCategories.has(categoria.nome) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </button>
                      <span className="text-lg text-white/70 cursor-move hover:text-amber-300 transition-colors" title="Clicca e trascina per spostare">
                        ⋮⋮
                      </span>
                      <span className="text-2xl">{getCategoryEmoji(categoria.nome)}</span>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {editingCategory === categoria.nome ? (
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEdit();
                                } else if (e.key === 'Escape') {
                                  setEditingCategory(null);
                                  setNewName("");
                                }
                              }}
                              className="bg-slate-900 border border-white/20-500 rounded px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                              autoFocus
                              onBlur={() => {
                                // Save on blur to handle all cases
                                handleSaveEdit();
                              }}
                            />
                          ) : (
                            <>
                              {categoria.nome}
                              <span className="text-xs text-white/70" title="Categoria trascinabile">🖱️</span>
                            </>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {categoria.prodottiCount} prodotti totali
                          {categoria.prodottiDiretti > 0 && ` (${categoria.prodottiDiretti} diretti)`}
                          {categoria.sottocategorie.length > 0 && ` • ${categoria.sottocategorie.length} sottocategorie`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingCategory(categoria.nome);
                          setNewName(categoria.nome);
                        }}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {(categoria.prodottiCount === 0 || categoria.prodottiDiretti === 0) && (
                        <button
                          onClick={() => handleDeleteCategory(categoria.nome)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded"
                          title="Elimina categoria"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sottocategorie */}
                  {expandedCategories.has(categoria.nome) && categoria.sottocategorie.length > 0 && (
                    <div className="border-t border-slate-700 bg-slate-900/40">
                      {categoria.sottocategorie.map((sub) => (
                        <div
                          key={sub.fullPath}
                          className={`flex items-center justify-between p-3 pl-16 hover:bg-slate-900/60 cursor-move border-b border-slate-700/50 last:border-b-0 transition-all duration-200 border-l-4 border-l-slate-600 hover:border-l-amber-400 ${
                            draggedOver === sub.fullPath && isDraggingProduct 
                              ? 'bg-white/10/20 border-white/15-500 shadow-lg scale-102' 
                              : draggedOver === sub.fullPath 
                              ? 'bg-white/15/20 border-white/20-500' 
                              : ''
                          } ${
                            draggedItem === sub.fullPath ? 'opacity-50 scale-95' : ''
                          }`}
                          draggable={!isDraggingProduct}
                          onClick={() => !isDraggingProduct && loadProdotti(sub.fullPath)}
                          onDragStart={(e) => {
                            if (!isDraggingProduct) {
                              e.stopPropagation();
                              handleDragStart(e, sub.fullPath);
                            }
                          }}
                          onDragOver={handleDragOver}
                          onDragEnter={(e) => {
                            e.stopPropagation();
                            if (isDraggingProduct) {
                              handleProductDragEnter(e, sub.fullPath);
                            } else {
                              handleDragEnter(e, sub.fullPath);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (isDraggingProduct) {
                              handleProductDragLeave(e);
                            } else {
                              handleDragLeave(e);
                            }
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handleDrop(e, sub.fullPath);
                          }}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl text-slate-500">└─</span>
                            <span className="text-sm text-white/70 cursor-move hover:text-amber-300 transition-colors" title="Clicca e trascina per spostare">
                              ⋮⋮
                            </span>
                            <div>
                              <div className="font-medium text-foreground flex items-center gap-2">
                                {editingCategory === sub.fullPath ? (
                                  <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEdit();
                                      } else if (e.key === 'Escape') {
                                        setEditingCategory(null);
                                        setNewName("");
                                      }
                                    }}
                                    className="bg-slate-900 border border-white/20-500 rounded px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                    autoFocus
                                    onBlur={() => {
                                      // Save on blur to handle all cases
                                      handleSaveEdit();
                                    }}
                                  />
                                ) : (
                                  <>
                                    {sub.nome}
                                    <span className="text-xs text-white/70" title="Sottocategoria trascinabile">🖱️</span>
                                  </>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {sub.prodottiCount} prodotti
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCategory(sub.fullPath);
                                setNewName(sub.nome);
                              }}
                              className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(sub.fullPath);
                              }}
                              className="p-1 bg-red-600 hover:bg-red-700 text-white rounded"
                              title="Elimina sottocategoria"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products in Selected Category */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Package className="h-5 w-5" />
              {globalSelectionMode 
                ? `Selezione Globale (${globalSelectedProducts.length} selezionati)` 
                : selectedCategory 
                  ? `Prodotti in "${selectedCategory}"${
                      selectedCategory && !selectedCategory.includes(' > ') && 
                      (categorieGerarchiche.find(cat => cat.nome === selectedCategory)?.sottocategorie.length || 0) > 0
                        ? ' (Categoria Principale)' 
                        : ''
                    }` 
                  : "Seleziona una Categoria"
              }
            </h2>
            {selectedProducts.length > 0 && !globalSelectionMode && (
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleMoveProducts(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-foreground"
                >
                  <option value="">Sposta in...</option>
                  {categorieFlat
                    .filter(cat => cat.nome !== selectedCategory)
                    .map((cat) => (
                      <option key={cat.nome} value={cat.nome}>
                        {cat.nome}
                      </option>
                    ))}
                  
                  {/* Aggiungi opzioni per creare sottocategorie comuni */}
                  {selectedCategory && !selectedCategory.includes(' > ') && (
                    <>
                      <option disabled>─── Crea sottocategorie ───</option>
                      {selectedCategory === 'APERITIVI' && (
                        <>
                          <option value={`${selectedCategory} > Gin`}>📁 Crea "APERITIVI {'>'} Gin"</option>
                          <option value={`${selectedCategory} > Vodka`}>📁 Crea "APERITIVI {'>'} Vodka"</option>
                          <option value={`${selectedCategory} > Rum`}>📁 Crea "APERITIVI {'>'} Rum"</option>
                          <option value={`${selectedCategory} > Whisky`}>📁 Crea "APERITIVI {'>'} Whisky"</option>
                        </>
                      )}
                      {selectedCategory === 'DISTILLATI' && (
                        <>
                          <option value={`${selectedCategory} > Whisky`}>📁 Crea "DISTILLATI {'>'} Whisky"</option>
                          <option value={`${selectedCategory} > Cognac`}>📁 Crea "DISTILLATI {'>'} Cognac"</option>
                          <option value={`${selectedCategory} > Grappa`}>📁 Crea "DISTILLATI {'>'} Grappa"</option>
                        </>
                      )}
                      {selectedCategory === 'VINI' && (
                        <>
                          <option value={`${selectedCategory} > Rosso`}>📁 Crea "VINI {'>'} Rosso"</option>
                          <option value={`${selectedCategory} > Bianco`}>📁 Crea "VINI {'>'} Bianco"</option>
                          <option value={`${selectedCategory} > Rosato`}>📁 Crea "VINI {'>'} Rosato"</option>
                          <option value={`${selectedCategory} > Spumante`}>📁 Crea "VINI {'>'} Spumante"</option>
                        </>
                      )}
                    </>
                  )}
                </select>
                <span className="text-sm text-muted-foreground">
                  {selectedProducts.length} selezionati
                </span>
              </div>
            )}
            
            {/* Pulsanti spostamento rapido verso sottocategorie */}
            {selectedCategory && selectedProducts.length > 0 && !globalSelectionMode && (
              <div className="space-y-2">
                {/* Sottocategorie esistenti */}
                {(categorieGerarchiche
                  .find(cat => cat.nome === selectedCategory)
                  ?.sottocategorie.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Sposta in sottocategorie esistenti:</span>
                    {categorieGerarchiche
                      .find(cat => cat.nome === selectedCategory)
                      ?.sottocategorie.map((sub) => (
                        <button
                          key={sub.fullPath}
                          onClick={() => handleMoveProducts(sub.fullPath)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                        >
                          → {sub.nome}
                        </button>
                      ))}
                  </div>
                )}
                
                {/* Pulsante per creare nuova sottocategoria e spostare */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Crea e sposta in:</span>
                  <input
                    type="text"
                    placeholder="Nome sottocategoria (es: Gin, Vodka)"
                    className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-foreground placeholder-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          handleCreateAndMoveToSubcategory(selectedCategory!, input.value.trim());
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">← Enter per creare</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Search and Filter Section */}
          {(selectedCategory || globalSelectionMode) && prodotti.length > 0 && (
            <div className="space-y-3 mb-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca prodotti..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              {/* Filter Controls */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterAvailable === null ? '' : filterAvailable.toString()}
                  onChange={(e) => setFilterAvailable(e.target.value === '' ? null : e.target.value === 'true')}
                  className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-foreground"
                >
                  <option value="">Tutti i prodotti</option>
                  <option value="true">Solo disponibili</option>
                  <option value="false">Solo non disponibili</option>
                </select>
                
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Prezzo min"
                    value={filterPriceRange.min || ''}
                    onChange={(e) => setFilterPriceRange(prev => ({...prev, min: e.target.value ? Number(e.target.value) : null}))}
                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-foreground placeholder-muted-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Prezzo max"
                    value={filterPriceRange.max || ''}
                    onChange={(e) => setFilterPriceRange(prev => ({...prev, max: e.target.value ? Number(e.target.value) : null}))}
                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-foreground placeholder-muted-foreground"
                  />
                </div>
                
                {(searchQuery || filterAvailable !== null || filterPriceRange.min !== null || filterPriceRange.max !== null) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterAvailable(null);
                      setFilterPriceRange({min: null, max: null});
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Cancella filtri
                  </button>
                )}
                
                {selectedProducts.length > 0 && (
                  <button
                    onClick={() => setShowBulkEditModal(true)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded flex items-center gap-1 ml-auto"
                  >
                    <Settings className="h-3 w-3" />
                    Modifica {selectedProducts.length} prodotti
                  </button>
                )}
              </div>
              
              {/* Results count */}
              {(searchQuery || filterAvailable !== null || filterPriceRange.min !== null || filterPriceRange.max !== null) && (
                <div className="text-sm text-muted-foreground">
                  Trovati {filteredProdotti.length} prodotti su {prodotti.length}
                </div>
              )}
            </div>
          )}
          
          {!globalSelectionMode && !selectedCategory ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Clicca su una categoria per vedere i prodotti</p>
            </div>
          ) : filteredProdotti.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>{prodotti.length === 0 ? "Nessun prodotto in questa categoria" : "Nessun prodotto trovato con i filtri applicati"}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProdotti.map((prodotto) => (
                <div
                  key={prodotto.id}
                  data-product-draggable
                  draggable={true}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-move transition-all duration-200 ${
                    selectedProducts.includes(prodotto.id)
                      ? "bg-white/15/20 border-white/20-500"
                      : "bg-slate-900/50 border-slate-700 hover:bg-slate-900"
                  } ${
                    draggedProduct?.id === prodotto.id 
                      ? "opacity-60 scale-95 shadow-lg border-white/15-400" 
                      : ""
                  }`}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleProductDragStart(e, prodotto);
                  }}
                  onDragEnd={handleProductDragEnd}
                  onClick={(e) => {
                    // Solo se non stiamo trascinando
                    if (!isDraggingProduct) {
                      if (globalSelectionMode) {
                        toggleGlobalProductSelection(prodotto);
                      } else {
                        setSelectedProducts(prev => 
                          prev.includes(prodotto.id)
                            ? prev.filter(id => id !== prodotto.id)
                            : [...prev, prodotto.id]
                        );
                      }
                    }
                  }}
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <span className="text-white/60 cursor-move hover:text-blue-300 mr-1" title="Trascina per spostare">
                        🖱️
                      </span>
                      {editingProduct === prodotto.id ? (
                        <input
                          type="text"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveProductEdit();
                            } else if (e.key === 'Escape') {
                              setEditingProduct(null);
                              setNewProductName("");
                            }
                          }}
                          className="bg-slate-900 border border-white/15-500 rounded px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          autoFocus
                          onBlur={() => {
                            setEditingProduct(null);
                            setNewProductName("");
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex items-center gap-2">
                          {prodotto.nome}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProduct(prodotto.id);
                              setNewProductName(prodotto.nome);
                            }}
                            className="p-1 text-white/60 hover:text-blue-300 hover:bg-slate-700 rounded transition-colors"
                            title="Modifica nome prodotto"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {!globalSelectionMode && selectedCategory && !prodotto.categoria.includes(' > ') && (
                        <span className="bg-green-700 px-1 py-0.5 rounded text-xs">
                          Principale
                        </span>
                      )}
                      {isDraggingProduct && draggedProduct?.id === prodotto.id && (
                        <span className="animate-pulse text-white/60 text-xs">
                          Trascinando...
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>€{prodotto.prezzo.toFixed(2)}</span>
                      {globalSelectionMode && (
                        <span className="bg-blue-700 px-2 py-1 rounded text-xs">
                          {prodotto.categoria}
                        </span>
                      )}
                      {prodotto.codice && (
                        <span className="bg-slate-700 px-2 py-1 rounded text-xs">
                          #{prodotto.codice}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 ${
                    globalSelectionMode 
                      ? globalSelectedProducts.some(p => p.id === prodotto.id)
                        ? "bg-purple-500 border-purple-500"
                        : "border-slate-500"
                      : selectedProducts.includes(prodotto.id)
                        ? "bg-white/15 border-white/20-500"
                        : "border-slate-500"
                  }`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Third Column - All Categories for Quick Move */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Sposta Veloce
            </h2>
            <div className="text-xs text-muted-foreground">
              {isDraggingProduct && draggedProduct ? (
                <span className="text-white/60 animate-pulse">
                  Trascinando: {draggedProduct.nome}
                </span>
              ) : selectedProducts.length > 0 ? (
                <span className="text-white/70">
                  {selectedProducts.length} prodotti selezionati
                </span>
              ) : (
                "Trascina prodotti qui"
              )}
            </div>
          </div>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {categorieGerarchiche.map((categoria) => (
              <div key={categoria.nome} className="space-y-1">
                {/* Categoria Principale */}
                <div
                  className={`p-3 bg-slate-900/50 border rounded-lg transition-all cursor-pointer hover:bg-slate-900 ${
                    draggedProduct && draggedOver === categoria.nome
                      ? 'bg-white/10/20 border-white/15-500 shadow-lg scale-102'
                      : 'border-slate-700'
                  } ${
                    selectedCategory === categoria.nome
                      ? 'ring-2 ring-amber-500'
                      : ''
                  }`}
                  onClick={() => loadProdotti(categoria.nome)}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => {
                    if (isDraggingProduct) {
                      setDraggedOver(categoria.nome);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDraggedOver(null);
                    }
                  }}
                  onDrop={(e) => handleCategoryDropProduct(e, categoria.nome)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCategoryEmoji(categoria.nome)}</span>
                      <div>
                        <div className="font-medium text-foreground">
                          {categoria.nome}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {categoria.prodottiCount} prodotti
                        </div>
                      </div>
                    </div>
                    {draggedProduct && draggedOver === categoria.nome && (
                      <div className="text-xs text-white/60 animate-pulse">
                        Rilascia qui
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Sottocategorie */}
                {categoria.sottocategorie.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {categoria.sottocategorie.map((sub) => (
                      <div
                        key={sub.fullPath}
                        className={`p-2 bg-slate-900/30 border rounded transition-all cursor-pointer hover:bg-slate-900/50 ${
                          draggedProduct && draggedOver === sub.fullPath
                            ? 'bg-white/10/20 border-white/15-500 shadow-lg scale-102'
                            : 'border-slate-700/50'
                        } ${
                          selectedCategory === sub.fullPath
                            ? 'ring-2 ring-amber-500'
                            : ''
                        }`}
                        onClick={() => loadProdotti(sub.fullPath)}
                        onDragOver={handleDragOver}
                        onDragEnter={(e) => {
                          if (isDraggingProduct) {
                            e.stopPropagation();
                            setDraggedOver(sub.fullPath);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDraggedOver(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleCategoryDropProduct(e, sub.fullPath);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">└</span>
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {sub.nome}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {sub.prodottiCount} prodotti
                              </div>
                            </div>
                          </div>
                          {draggedProduct && draggedOver === sub.fullPath && (
                            <div className="text-xs text-white/60 animate-pulse">
                              Rilascia
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Sezione per creare nuove sottocategorie al volo */}
            {draggedProduct && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-muted-foreground mb-2">
                  Crea nuova sottocategoria:
                </div>
                {categorieGerarchiche.map((categoria) => (
                  <div
                    key={`new-${categoria.nome}`}
                    className="p-3 mb-2 bg-green-900/20 border-2 border-dashed border-white/15-700 rounded-lg hover:bg-green-900/30 transition-all"
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => setDraggedOver(`new-sub-${categoria.nome}`)}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDraggedOver(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const productData = e.dataTransfer.getData('application/product');
                      if (productData) {
                        const product = JSON.parse(productData);
                        // Prompt per nome sottocategoria
                        const subName = prompt(`Crea nuova sottocategoria in ${categoria.nome}:`);
                        if (subName && subName.trim()) {
                          const newCategoryPath = `${categoria.nome} > ${subName.trim()}`;
                          handleCategoryDropProduct(e, newCategoryPath);
                        }
                      }
                      setDraggedOver(null);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-white/60" />
                      <span className="text-sm text-white/60">
                        Nuova in {categoria.nome}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}