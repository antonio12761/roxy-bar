"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, 
  Plus, 
  Type, 
  Image as ImageIcon, 
  Save, 
  Download,
  Upload,
  Trash2,
  Move,
  Eye,
  Settings
} from "lucide-react";
import Link from "next/link";
import { getCategories, getProducts } from "@/lib/actions/products";
import { getCategorieGerarchiche, getProdottiByCategoria } from "@/lib/actions/categorie";
import { getProdotti } from "@/lib/actions/ordinazioni";
import { AuthGuard } from "@/components/auth-guard";

// Types per i prodotti del nuovo sistema
interface Category {
  id: number;
  name: string;
  icon?: string | null;
  order: number;
  productsCount: number;
  subcategories: Subcategory[];
  _count?: {
    products: number;
  };
}

interface Subcategory {
  id: number;
  name: string;
  order: number;
  categoryId: number;
  productsCount: number;
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
}

// Types per i prodotti del vecchio sistema
interface OldCategory {
  nome: string;
  prodottiCount: number;
  prodottiDiretti: number;
  sottocategorie: {
    nome: string;
    fullPath: string;
    prodottiCount: number;
  }[];
}

interface OldProduct {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  codice?: number | null;
}

// Types per il menu builder
interface MenuElement {
  id: string;
  type: 'heading' | 'text' | 'product' | 'separator' | 'image';
  content?: string;
  productId?: number;
  productData?: Product | OldProduct;
  style?: React.CSSProperties;
  imageUrl?: string;
  imageSize?: 'small' | 'medium' | 'large';
}

export default function MenuBuilderPage() {
  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body { margin: 0; }
        .print\\:hidden { display: none !important; }
        .print\\:shadow-none { box-shadow: none !important; }
        .print\\:block { display: block !important; }
        .print\\:bg-black { background-color: black !important; color: white !important; }
        
        /* Modalità scura per stampa */
        .bg-gray-900 { background: #1f2937 !important; color: white !important; }
        .bg-white { background: white !important; color: black !important; }
        .text-gray-900 { color: black !important; }
        .text-white { color: white !important; }
        .text-gray-400 { color: #9ca3af !important; }
        
        .border { border: none !important; }
        .rounded-lg { border-radius: 0 !important; }
        .p-6 { padding: 1rem !important; }
        .space-y-2 > * + * { margin-top: 0.5rem !important; }
        .min-h-screen { min-height: auto !important; }
        .h-\\[calc\\(100vh-200px\\)\\] { height: auto !important; }
        .grid-cols-3 { grid-template-columns: none !important; }
        .overflow-y-auto { overflow: visible !important; }
        page-break-inside: avoid;
      }
      @page {
        margin: 1cm;
        size: A4;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  // States per categorie e prodotti
  const [categories, setCategories] = useState<Category[]>([]);
  const [oldCategories, setOldCategories] = useState<OldCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [oldProducts, setOldProducts] = useState<OldProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useOldSystem, setUseOldSystem] = useState(false);

  // States per il menu builder
  const [menuElements, setMenuElements] = useState<MenuElement[]>([]);
  const [draggedProduct, setDraggedProduct] = useState<Product | OldProduct | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // States per editing
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'elements'>('products');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [hasLocalSave, setHasLocalSave] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedElementForStyling, setSelectedElementForStyling] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadMenuFromLocal();
  }, []);

  // Auto-salvataggio ogni volta che il menu cambia
  useEffect(() => {
    if (menuElements.length > 0) {
      saveMenuToLocal();
    }
  }, [menuElements]);

  // Salvataggio automatico nel localStorage
  const saveMenuToLocal = () => {
    try {
      const timestamp = new Date().toISOString();
      const menuData = {
        elements: menuElements,
        timestamp,
        selectedCategory
      };
      localStorage.setItem('menu-builder-autosave', JSON.stringify(menuData));
      setHasLocalSave(true);
      setLastSaveTime(timestamp);
      console.log("💾 Menu salvato automaticamente in locale");
    } catch (error) {
      console.error("❌ Errore salvataggio locale:", error);
    }
  };

  // Caricamento dal localStorage
  const loadMenuFromLocal = () => {
    try {
      const savedData = localStorage.getItem('menu-builder-autosave');
      if (savedData) {
        const menuData = JSON.parse(savedData);
        console.log("📂 Menu caricato da salvataggio locale:", menuData.timestamp);
        setMenuElements(menuData.elements || []);
        setHasLocalSave(true);
        setLastSaveTime(menuData.timestamp);
        // Non ripristiniamo selectedCategory per non interferire con la navigazione
      }
    } catch (error) {
      console.error("❌ Errore caricamento locale:", error);
    }
  };

  // Pulizia salvataggio locale
  const clearLocalSave = () => {
    try {
      localStorage.removeItem('menu-builder-autosave');
      setMenuElements([]);
      setHasLocalSave(false);
      setLastSaveTime(null);
      console.log("🗑️ Salvataggio locale cancellato");
    } catch (error) {
      console.error("❌ Errore cancellazione locale:", error);
    }
  };

  // Formatta il tempo per la visualizzazione
  const formatSaveTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Sconosciuto';
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log("🔄 Caricamento dati...");
      
      // Usa sempre il vecchio sistema per essere coerente con "Gestione Categorie"
      try {
        const [oldCats, allOldProds] = await Promise.all([
          getCategorieGerarchiche(),
          getProdotti()
        ]);
        
        console.log("📊 Vecchio sistema - Categorie:", oldCats.length, "Prodotti:", allOldProds.length);
        
        setOldCategories(oldCats);
        setOldProducts(allOldProds);
        setUseOldSystem(true);
        console.log("✅ Utilizzando vecchio sistema categorie (per coerenza con Gestione Categorie)");
        
        // Se il vecchio sistema non ha categorie, prova il nuovo come fallback
        if (oldCats.length === 0) {
          console.log("⚠️ Nessuna categoria nel vecchio sistema, provo il nuovo...");
          const [newCategories, newProducts] = await Promise.all([
            getCategories(),
            getProducts()
          ]);
          
          console.log("📊 Nuovo sistema - Categorie:", newCategories.length, "Prodotti:", newProducts.length);
          
          if (newCategories.length > 0) {
            // Assicurati che le sottocategorie abbiano la proprietà productsCount
            const categoriesWithSubcategoryCount = newCategories.map(category => ({
              ...category,
              subcategories: category.subcategories.map(sub => ({
                ...sub,
                productsCount: (sub as any)._count?.products || 0
              }))
            }));
            setCategories(categoriesWithSubcategoryCount);
            setProducts(newProducts);
            setUseOldSystem(false);
            console.log("✅ Fallback al nuovo sistema categorie");
          }
        }
      } catch (error) {
        console.error("❌ Errore caricamento vecchio sistema:", error);
      }
      
    } catch (error) {
      console.error("❌ Errore generale caricamento dati:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProductsByCategory = async (categoryName: string) => {
    setLoadingProducts(true);
    try {
      console.log("🔍 Caricamento prodotti per categoria:", categoryName);
      console.log("🔧 Sistema in uso:", useOldSystem ? "Vecchio" : "Nuovo");
      
      if (useOldSystem) {
        const products = await getProdottiByCategoria(categoryName);
        console.log("📦 Prodotti caricati (vecchio sistema):", products.length, products);
        setOldProducts(products);
      } else {
        // Per il nuovo sistema, ricarica tutti i prodotti e poi filtra
        console.log("🔄 Ricaricamento prodotti per filtro...");
        const allProducts = await getProducts();
        console.log("📊 Tutti i prodotti disponibili:", allProducts.length);
        
        const category = categories.find(cat => cat.name === categoryName);
        console.log("🎯 Categoria trovata:", category);
        
        if (category) {
          const filteredProducts = allProducts.filter(p => 
            p.categoryId === category.id || 
            p.subcategory?.categoryId === category.id
          );
          console.log("📦 Prodotti filtrati (nuovo sistema):", filteredProducts.length, filteredProducts);
          setProducts(filteredProducts);
        } else {
          console.log("⚠️ Categoria non trovata, provo con approccio diretto");
          // Fallback: cerca prodotti con nome categoria
          const directProducts = allProducts.filter(p => 
            p.category?.name === categoryName ||
            p.subcategory?.name === categoryName
          );
          console.log("📦 Prodotti diretti:", directProducts.length, directProducts);
          setProducts(directProducts);
        }
      }
      setSelectedCategory(categoryName);
    } catch (error) {
      console.error("❌ Errore caricamento prodotti:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Drag & Drop handlers per prodotti e elementi
  const handleProductDragStart = (e: React.DragEvent, product: Product | OldProduct) => {
    setDraggedProduct(product);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('type', 'product');
  };

  const handleElementDragStart = (e: React.DragEvent, elementType: string) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('type', 'element');
    e.dataTransfer.setData('elementType', elementType);
  };

  const handleProductDragEnd = () => {
    setDraggedProduct(null);
    setIsDragging(false);
    setDragOverIndex(null);
  };

  const handleMenuDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  };

  const handleMenuDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleMenuDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    const dropType = e.dataTransfer.getData('type');
    
    if (dropType === 'product' && draggedProduct) {
      const newElement: MenuElement = {
        id: `product-${Date.now()}`,
        type: 'product',
        productId: draggedProduct.id,
        productData: draggedProduct,
        style: {
          fontSize: '16px',
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'left'
        }
      };

      const newElements = [...menuElements];
      newElements.splice(index, 0, newElement);
      setMenuElements(newElements);
    } else if (dropType === 'element') {
      const elementType = e.dataTransfer.getData('elementType');
      let newElement: MenuElement;

      switch (elementType) {
        case 'heading':
          newElement = {
            id: `heading-${Date.now()}`,
            type: 'heading',
            content: 'Nuovo Titolo',
            style: {
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#000000',
              textAlign: 'left',
              marginTop: '10px',
              marginBottom: '10px'
            }
          };
          break;
        case 'text':
          newElement = {
            id: `text-${Date.now()}`,
            type: 'text',
            content: 'Nuovo testo',
            style: {
              fontSize: '16px',
              fontWeight: 'normal',
              color: '#000000',
              textAlign: 'left',
              marginTop: '10px',
              marginBottom: '10px'
            }
          };
          break;
        case 'separator':
          newElement = {
            id: `separator-${Date.now()}`,
            type: 'separator',
            style: {
              marginTop: '15px',
              marginBottom: '15px'
            }
          };
          break;
        case 'image':
          const imageUrl = prompt('Inserisci URL dell\'immagine:');
          if (!imageUrl) return;
          newElement = {
            id: `image-${Date.now()}`,
            type: 'image',
            imageUrl,
            imageSize: 'medium',
            style: {
              textAlign: 'center',
              marginTop: '10px',
              marginBottom: '10px'
            }
          };
          break;
        default:
          return;
      }

      const newElements = [...menuElements];
      newElements.splice(index, 0, newElement);
      setMenuElements(newElements);
      
      // Auto-edit per elementi di testo
      if (elementType === 'heading' || elementType === 'text') {
        setTimeout(() => setEditingElement(newElement.id), 100);
      }
    }

    setDragOverIndex(null);
    setDraggedProduct(null);
    setIsDragging(false);
  };

  // Funzioni per gestire gli elementi del menu
  const addTextElement = (type: 'heading' | 'text') => {
    const newElement: MenuElement = {
      id: `${type}-${Date.now()}`,
      type,
      content: type === 'heading' ? 'Nuovo Titolo' : 'Nuovo testo',
      style: {
        fontSize: type === 'heading' ? '24px' : '16px',
        fontWeight: type === 'heading' ? 'bold' : 'normal',
        color: '#000000',
        textAlign: 'left',
        marginTop: '10px',
        marginBottom: '10px'
      }
    };
    setMenuElements([...menuElements, newElement]);
    setEditingElement(newElement.id);
  };

  const addSeparator = () => {
    const newElement: MenuElement = {
      id: `separator-${Date.now()}`,
      type: 'separator',
      style: {
        marginTop: '15px',
        marginBottom: '15px'
      }
    };
    setMenuElements([...menuElements, newElement]);
  };

  const addImage = () => {
    const imageUrl = prompt('Inserisci URL dell\'immagine:');
    if (imageUrl) {
      const newElement: MenuElement = {
        id: `image-${Date.now()}`,
        type: 'image',
        imageUrl,
        imageSize: 'medium',
        style: {
          textAlign: 'center',
          marginTop: '10px',
          marginBottom: '10px'
        }
      };
      setMenuElements([...menuElements, newElement]);
    }
  };

  const updateElement = (id: string, updates: Partial<MenuElement>) => {
    setMenuElements(elements => 
      elements.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  };

  const updateElementStyle = (id: string, styleUpdates: Partial<MenuElement['style']>) => {
    setMenuElements(elements => 
      elements.map(el => el.id === id ? { 
        ...el, 
        style: { ...el.style, ...styleUpdates } 
      } : el)
    );
  };

  const getElementById = (id: string) => {
    return menuElements.find(el => el.id === id);
  };

  const removeElement = (id: string) => {
    setMenuElements(elements => elements.filter(el => el.id !== id));
  };

  const moveElement = (id: string, direction: 'up' | 'down') => {
    setMenuElements(elements => {
      const index = elements.findIndex(el => el.id === id);
      if (index === -1) return elements;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= elements.length) return elements;
      
      const newElements = [...elements];
      [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
      return newElements;
    });
  };

  // Funzioni per salvare/caricare il menu
  const saveMenu = () => {
    const menuData = JSON.stringify(menuElements, null, 2);
    const blob = new Blob([menuData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadMenu = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const menuData = JSON.parse(event.target?.result as string);
          setMenuElements(menuData);
        } catch (error) {
          alert('Errore nel caricamento del file menu');
        }
      };
      reader.readAsText(file);
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  // Render del prodotto nel menu
  const renderProductInMenu = (element: MenuElement) => {
    const product = element.productData;
    if (!product) return null;

    const isOldProduct = 'nome' in product;
    const name = isOldProduct ? product.nome : product.name;
    const price = isOldProduct ? product.prezzo : (product.price || 0);
    const code = isOldProduct ? product.codice : null;

    return (
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {code && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              darkMode 
                ? 'bg-gray-700 text-yellow-300' 
                : 'bg-gray-800 text-white'
            }`}>
              #{code}
            </span>
          )}
          <span style={element.style as React.CSSProperties}>{name}</span>
        </div>
        <span style={{ ...(element.style as React.CSSProperties), fontWeight: 'bold' }}>
          €{price.toFixed(2)}
        </span>
      </div>
    );
  };

  const getCategoryEmoji = (categoryName: string) => {
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
    return emojiMap[categoryName.toUpperCase()] || '🍽️';
  };

  // Style Panel Component
  const StylePanel = ({ elementId }: { elementId: string }) => {
    const element = getElementById(elementId);
    if (!element || (element.type !== 'heading' && element.type !== 'text')) return null;

    const currentStyle = element.style || {};

    return (
      <div className="fixed top-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-4 w-80 z-50 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            🎨 Stili Testo
          </h3>
          <button
            onClick={() => setSelectedElementForStyling(null)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Font Family */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Font</label>
            <select
              value={(currentStyle.fontFamily as string) || 'inherit'}
              onChange={(e) => updateElementStyle(elementId, { fontFamily: e.target.value })}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
            >
              <option value="inherit">Default</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
              <option value="Impact, sans-serif">Impact</option>
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Dimensione</label>
            <div className="flex gap-2">
              <input
                type="range"
                min="12"
                max="72"
                value={parseInt((currentStyle.fontSize as string)?.replace('px', '') || '16')}
                onChange={(e) => updateElementStyle(elementId, { fontSize: `${e.target.value}px` })}
                className="flex-1"
              />
              <span className="text-white text-sm w-12">
                {(currentStyle.fontSize as string) || '16px'}
              </span>
            </div>
          </div>

          {/* Text Align */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Allineamento</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateElementStyle(elementId, { textAlign: 'left' })}
                className={`flex-1 p-2 rounded ${
                  (currentStyle.textAlign as string) === 'left' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                ⬅️ Sinistra
              </button>
              <button
                onClick={() => updateElementStyle(elementId, { textAlign: 'center' })}
                className={`flex-1 p-2 rounded ${
                  (currentStyle.textAlign as string) === 'center' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                ↔️ Centro
              </button>
              <button
                onClick={() => updateElementStyle(elementId, { textAlign: 'right' })}
                className={`flex-1 p-2 rounded ${
                  (currentStyle.textAlign as string) === 'right' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                ➡️ Destra
              </button>
            </div>
          </div>

          {/* Font Weight */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Peso Font</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateElementStyle(elementId, { fontWeight: 'normal' })}
                className={`flex-1 p-2 rounded ${
                  (currentStyle.fontWeight as string) === 'normal' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                Normale
              </button>
              <button
                onClick={() => updateElementStyle(elementId, { fontWeight: 'bold' })}
                className={`flex-1 p-2 rounded ${
                  (currentStyle.fontWeight as string) === 'bold' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                <strong>Grassetto</strong>
              </button>
            </div>
          </div>

          {/* Text Decoration */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Decorazione</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateElementStyle(elementId, { textDecoration: 'none' })}
                className={`flex-1 p-2 rounded ${
                  ((currentStyle.textDecoration as string) === 'none' || !currentStyle.textDecoration) ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                Normale
              </button>
              <button
                onClick={() => updateElementStyle(elementId, { textDecoration: 'underline' })}
                className={`flex-1 p-2 rounded ${
                  (currentStyle.textDecoration as string) === 'underline' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                } text-white`}
              >
                <u>Sottolineato</u>
              </button>
            </div>
          </div>

          {/* Text Color */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Colore Testo</label>
            <div className="grid grid-cols-4 gap-2">
              {['#ffffff', '#000000', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#f97316'].map(color => (
                <button
                  key={color}
                  onClick={() => updateElementStyle(elementId, { color })}
                  className={`w-12 h-8 rounded border-2 ${
                    (currentStyle.color as string) === color ? 'border-white' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <input
              type="color"
              value={(currentStyle.color as string) || '#ffffff'}
              onChange={(e) => updateElementStyle(elementId, { color: e.target.value })}
              className="w-full mt-2 h-8 rounded"
            />
          </div>

          {/* Spacing */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Spaziatura</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">Sopra</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={parseInt((currentStyle.marginTop as string)?.replace('px', '') || '10')}
                  onChange={(e) => updateElementStyle(elementId, { marginTop: `${e.target.value}px` })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Sotto</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={parseInt((currentStyle.marginBottom as string)?.replace('px', '') || '10')}
                  onChange={(e) => updateElementStyle(elementId, { marginBottom: `${e.target.value}px` })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-white/70" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Menu Builder</h1>
            <p className="text-muted-foreground">Crea e personalizza il menu del tuo locale</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {hasLocalSave && lastSaveTime && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-700 rounded-lg">
              <span className="text-sm text-green-200">
                💾 Salvato automaticamente alle {formatSaveTime(lastSaveTime)}
              </span>
              <button
                onClick={clearLocalSave}
                className="ml-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                title="Cancella salvataggio locale"
              >
                🗑️
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg">
            <span className="text-sm text-muted-foreground">
              💡 Usa i tab nella colonna centrale per aggiungere elementi
            </span>
          </div>
          <button
            onClick={() => {
              console.log("🔍 DEBUG INFO:");
              console.log("Sistema in uso:", useOldSystem ? "Vecchio" : "Nuovo");
              console.log("Categorie caricate:", useOldSystem ? oldCategories : categories);
              console.log("Prodotti attuali:", useOldSystem ? oldProducts : products);
              console.log("Categoria selezionata:", selectedCategory);
              console.log("Salvataggio locale:", hasLocalSave, lastSaveTime);
            }}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
          >
            🐛 Debug
          </button>
          <div className="ml-auto flex gap-3">
            <label className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Carica Menu
              <input type="file" accept=".json" onChange={loadMenu} className="hidden" />
            </label>
            <button
              onClick={saveMenu}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Salva Menu
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Esporta PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        
        {/* Colonna Sinistra - Categorie */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            🗂️ Categorie
            {useOldSystem && <span className="text-xs bg-white/15 px-2 py-1 rounded">Vecchio Sistema</span>}
            {!useOldSystem && categories.length > 0 && <span className="text-xs bg-white/10 px-2 py-1 rounded">Nuovo Sistema</span>}
          </h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/20-400 mx-auto mb-2"></div>
              Caricamento categorie...
            </div>
          ) : useOldSystem ? (
            oldCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">📭</div>
                <p>Nessuna categoria trovata</p>
              </div>
            ) : (
              <div className="space-y-2">
                {oldCategories.map((category) => (
                  <div key={category.nome} className="border border-slate-600 rounded-lg">
                    <div 
                      className={`p-3 bg-slate-900/50 cursor-pointer hover:bg-slate-900 transition-colors ${
                        selectedCategory === category.nome ? 'bg-white/15/20 border-white/20-500' : ''
                      }`}
                      onClick={() => loadProductsByCategory(category.nome)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getCategoryEmoji(category.nome)}</span>
                        <div>
                          <div className="font-medium text-foreground">{category.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {category.prodottiCount} prodotti
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {category.sottocategorie.length > 0 && (
                      <div className="border-t border-slate-600 bg-slate-900/30">
                        {category.sottocategorie.map((sub) => (
                          <div
                            key={sub.fullPath}
                            className={`p-2 pl-8 hover:bg-slate-900/50 cursor-pointer border-b border-slate-700 last:border-b-0 ${
                              selectedCategory === sub.fullPath ? 'bg-white/15/20' : ''
                            }`}
                            onClick={() => loadProductsByCategory(sub.fullPath)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">└</span>
                              <div>
                                <div className="text-sm font-medium text-foreground">{sub.nome}</div>
                                <div className="text-xs text-muted-foreground">{sub.prodottiCount} prodotti</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">📭</div>
                <p>Nessuna categoria trovata</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="border border-slate-600 rounded-lg">
                    <div 
                      className={`p-3 bg-slate-900/50 cursor-pointer hover:bg-slate-900 transition-colors ${
                        selectedCategory === category.name ? 'bg-white/15/20 border-white/20-500' : ''
                      }`}
                      onClick={() => loadProductsByCategory(category.name)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{category.icon || '🍽️'}</span>
                        <div>
                          <div className="font-medium text-foreground">{category.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {category.productsCount} prodotti
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {category.subcategories.length > 0 && (
                      <div className="border-t border-slate-600 bg-slate-900/30">
                        {category.subcategories.map((sub) => (
                          <div
                            key={sub.id}
                            className="p-2 pl-8 hover:bg-slate-900/50 cursor-pointer border-b border-slate-700 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">└</span>
                              <div>
                                <div className="text-sm font-medium text-foreground">{sub.name}</div>
                                <div className="text-xs text-muted-foreground">{sub.productsCount} prodotti</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Colonna Centrale - Prodotti ed Elementi */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-y-auto">
          {/* Tab Header */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'products'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-700 text-muted-foreground hover:bg-slate-600'
              }`}
            >
              📦 Prodotti
            </button>
            <button
              onClick={() => setActiveTab('elements')}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'elements'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-700 text-muted-foreground hover:bg-slate-600'
              }`}
            >
              🧩 Elementi
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'products' ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                📦 Prodotti {selectedCategory && `- ${selectedCategory}`}
              </h2>
              
              {!selectedCategory ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-6xl mb-4">📦</div>
                  <p>Seleziona una categoria per vedere i prodotti</p>
                </div>
              ) : loadingProducts ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/20-400 mx-auto mb-2"></div>
                  <p>Caricamento prodotti...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(useOldSystem ? oldProducts : products).map((product) => {
                    const isOldProduct = 'nome' in product;
                    const name = isOldProduct ? product.nome : product.name;
                    const price = isOldProduct ? product.prezzo : (product.price || 0);
                    const code = isOldProduct ? product.codice : null;
                    
                    return (
                      <div
                        key={product.id}
                        draggable
                        onDragStart={(e) => handleProductDragStart(e, product)}
                        onDragEnd={handleProductDragEnd}
                        className={`p-3 border rounded-lg cursor-move transition-all ${
                          isDragging && draggedProduct?.id === product.id
                            ? 'opacity-50 scale-95 border-white/15-400'
                            : 'bg-slate-900/50 border-slate-700 hover:bg-slate-900 hover:border-white/20-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-foreground flex items-center gap-2">
                              <span className="text-white/60" title="Trascina nel menu">🖱️</span>
                              {code && (
                                <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-bold">
                                  #{code}
                                </span>
                              )}
                              {name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              €{price.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {(useOldSystem ? oldProducts : products).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">📦</div>
                      <p>Nessun prodotto in questa categoria</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                🧩 Elementi Menu
              </h2>
              
              <div className="space-y-3">
                {/* Elemento Titolo */}
                <div
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'heading')}
                  onDragEnd={handleProductDragEnd}
                  className="p-4 border rounded-lg cursor-move transition-all bg-blue-900/30 border-white/15-600 hover:bg-blue-900/50 hover:border-white/15-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📝</span>
                    <div>
                      <div className="font-semibold text-blue-300">Titolo</div>
                      <div className="text-sm text-white/60">Aggiungi un titolo di sezione</div>
                    </div>
                    <span className="text-white/60 ml-auto" title="Trascina nel menu">🖱️</span>
                  </div>
                </div>

                {/* Elemento Testo */}
                <div
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'text')}
                  onDragEnd={handleProductDragEnd}
                  className="p-4 border rounded-lg cursor-move transition-all bg-green-900/30 border-white/15-600 hover:bg-green-900/50 hover:border-white/15-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <div className="font-semibold text-green-300">Testo</div>
                      <div className="text-sm text-white/60">Aggiungi paragrafo o descrizione</div>
                    </div>
                    <span className="text-white/60 ml-auto" title="Trascina nel menu">🖱️</span>
                  </div>
                </div>

                {/* Elemento Separatore */}
                <div
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'separator')}
                  onDragEnd={handleProductDragEnd}
                  className="p-4 border rounded-lg cursor-move transition-all bg-purple-900/30 border-purple-600 hover:bg-purple-900/50 hover:border-purple-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">➖</span>
                    <div>
                      <div className="font-semibold text-purple-300">Separatore</div>
                      <div className="text-sm text-purple-400">Linea di separazione</div>
                    </div>
                    <span className="text-purple-400 ml-auto" title="Trascina nel menu">🖱️</span>
                  </div>
                </div>

                {/* Elemento Immagine */}
                <div
                  draggable
                  onDragStart={(e) => handleElementDragStart(e, 'image')}
                  onDragEnd={handleProductDragEnd}
                  className="p-4 border rounded-lg cursor-move transition-all bg-orange-900/30 border-orange-600 hover:bg-orange-900/50 hover:border-orange-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🖼️</span>
                    <div>
                      <div className="font-semibold text-orange-300">Immagine</div>
                      <div className="text-sm text-orange-400">Aggiungi immagine da URL</div>
                    </div>
                    <span className="text-orange-400 ml-auto" title="Trascina nel menu">🖱️</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
                <h3 className="text-sm font-semibold text-foreground mb-2">💡 Come usare:</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Trascina gli elementi nella colonna di anteprima</li>
                  <li>• Clicca su titoli e testi per modificarli</li>
                  <li>• Usa i controlli a sinistra per riordinare</li>
                  <li>• Le immagini richiedono un URL</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Colonna Destra - Anteprima Menu */}
        <div className={`border border-slate-700 rounded-lg p-6 overflow-y-auto transition-colors ${
          darkMode 
            ? 'bg-gray-900 text-white' 
            : 'bg-white text-gray-900'
        }`}>
          <div className="flex items-center justify-between mb-4 print:hidden">
            <h2 className={`text-xl font-semibold flex items-center gap-2 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              👁️ Anteprima Menu
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  darkMode 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
                title={darkMode ? 'Modalità chiara' : 'Modalità scura'}
              >
                {darkMode ? '☀️' : '🌙'}
                {darkMode ? 'Chiaro' : 'Scuro'}
              </button>
              <button
                onClick={() => {
                  if (hasLocalSave && menuElements.length > 0) {
                    if (confirm('Sei sicuro di voler cancellare tutto il menu? Il salvataggio automatico verrà perso.')) {
                      clearLocalSave();
                    }
                  } else {
                    setMenuElements([]);
                  }
                }}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded"
                title="Cancella tutto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="min-h-[400px] space-y-2">
            {menuElements.length === 0 ? (
              <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <div className="text-6xl mb-4">📄</div>
                <p>Il tuo menu apparirà qui</p>
                <p className="text-sm mt-2">Aggiungi elementi o trascina prodotti dalla lista</p>
              </div>
            ) : (
              menuElements.map((element, index) => (
                <div key={element.id} className="group relative">
                  {/* Drop zone */}
                  <div
                    className={`w-full h-2 ${
                      dragOverIndex === index ? 'bg-white/8' : 'transparent'
                    }`}
                    onDragOver={(e) => handleMenuDragOver(e, index)}
                    onDragLeave={handleMenuDragLeave}
                    onDrop={(e) => handleMenuDrop(e, index)}
                  />
                  
                  <div className="relative">
                    {/* Controls */}
                    <div className="absolute -left-16 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <button
                        onClick={() => moveElement(element.id, 'up')}
                        className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                        title="Sposta su"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveElement(element.id, 'down')}
                        className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                        title="Sposta giù"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setEditingElement(element.id)}
                        className="p-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      {(element.type === 'heading' || element.type === 'text') && (
                        <button
                          onClick={() => setSelectedElementForStyling(element.id)}
                          className="p-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                          title="Stili"
                        >
                          🎨
                        </button>
                      )}
                      <button
                        onClick={() => removeElement(element.id)}
                        className="p-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Element content */}
                    <div className="min-h-[20px]" style={element.style as React.CSSProperties}>
                      {element.type === 'heading' && (
                        editingElement === element.id ? (
                          <input
                            type="text"
                            value={element.content || ''}
                            onChange={(e) => updateElement(element.id, { content: e.target.value })}
                            onBlur={() => setEditingElement(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingElement(null)}
                            className={`w-full bg-transparent border-b focus:outline-none ${
                              darkMode ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900'
                            }`}
                            style={element.style as React.CSSProperties}
                            autoFocus
                          />
                        ) : (
                          <h2 style={element.style as React.CSSProperties} onClick={() => setEditingElement(element.id)}>
                            {element.content}
                          </h2>
                        )
                      )}
                      
                      {element.type === 'text' && (
                        editingElement === element.id ? (
                          <textarea
                            value={element.content || ''}
                            onChange={(e) => updateElement(element.id, { content: e.target.value })}
                            onBlur={() => setEditingElement(null)}
                            className={`w-full bg-transparent border focus:outline-none resize-none ${
                              darkMode ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900'
                            }`}
                            style={element.style as React.CSSProperties}
                            autoFocus
                            rows={3}
                          />
                        ) : (
                          <p style={element.style as React.CSSProperties} onClick={() => setEditingElement(element.id)}>
                            {element.content}
                          </p>
                        )
                      )}
                      
                      {element.type === 'product' && renderProductInMenu(element)}
                      
                      {element.type === 'separator' && (
                        <hr className={`${darkMode ? 'border-gray-600' : 'border-gray-300'}`} style={element.style as React.CSSProperties} />
                      )}
                      
                      {element.type === 'image' && element.imageUrl && (
                        <div style={element.style as React.CSSProperties}>
                          <img
                            src={element.imageUrl}
                            alt="Menu image"
                            className={`${
                              element.imageSize === 'small' ? 'w-24' :
                              element.imageSize === 'large' ? 'w-full' :
                              'w-48'
                            } mx-auto`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Final drop zone */}
            <div
              className={`w-full h-8 ${
                dragOverIndex === menuElements.length 
                  ? 'bg-white/8' 
                  : darkMode 
                    ? 'bg-gray-800 border-2 border-dashed border-gray-600' 
                    : 'bg-gray-100 border-2 border-dashed border-gray-300'
              }`}
              onDragOver={(e) => handleMenuDragOver(e, menuElements.length)}
              onDragLeave={handleMenuDragLeave}
              onDrop={(e) => handleMenuDrop(e, menuElements.length)}
            >
              <div className={`flex items-center justify-center h-full text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Trascina qui i prodotti
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* StylePanel */}
      {selectedElementForStyling && (
        <StylePanel
          elementId={selectedElementForStyling}
        />
      )}
    </div>
    </AuthGuard>
  );
}