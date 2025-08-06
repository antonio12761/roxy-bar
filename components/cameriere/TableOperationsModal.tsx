"use client";

import { useState, useEffect } from "react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  ShoppingCart, 
  CreditCard, 
  FileText, 
  Clock, 
  Users,
  Plus,
  Eye,
  History,
  AlertTriangle,
  Edit,
  Trash2,
  UserX,
  X
} from "lucide-react";
import Link from "next/link";
import { getTableOrdersInfo } from "@/lib/actions/ordinazioni";

interface Table {
  id: number;
  numero: string;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
  posti: number;
  zona?: string | null;
  clienteNome?: string | null;
  hasOutOfStockOrder?: boolean;
  outOfStockHandledBy?: string | null;
  outOfStockOrders?: any[];
  GruppoTavoli?: {
    id: number;
    nome: string;
    colore?: string | null;
    icona?: string | null;
  } | null;
}

interface TableOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
  onTableUpdate?: () => void; // Callback per aggiornare i tavoli
}

export function TableOperationsModal({ isOpen, onClose, table, onTableUpdate }: TableOperationsModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [ordersCount, setOrdersCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showOutOfStockManagement, setShowOutOfStockManagement] = useState(false);
  const [outOfStockOrderDetails, setOutOfStockOrderDetails] = useState<any>(null);
  const [loadingOutOfStock, setLoadingOutOfStock] = useState(false);

  // Carica i dati reali del tavolo
  useEffect(() => {
    const loadTableData = async () => {
      if (table && table.stato === "OCCUPATO") {
        setIsLoading(true);
        try {
          const data = await getTableOrdersInfo(table.id);
          setOrdersCount(data.ordersCount);
          setPendingAmount(data.pendingAmount);
        } catch (error) {
          console.error("Errore caricamento dati tavolo:", error);
          setOrdersCount(0);
          setPendingAmount(0);
        } finally {
          setIsLoading(false);
        }
      } else {
        setOrdersCount(0);
        setPendingAmount(0);
      }
    };

    loadTableData();
  }, [table]);

  if (!table) return null;

  const actions = [
    {
      id: "new-order",
      title: "Nuovo Ordine",
      description: "Aggiungi un nuovo ordine a questo tavolo",
      icon: ShoppingCart,
      color: "bg-blue-500",
      href: `/cameriere/tavolo/${table.id}`,
      available: true
    },
    {
      id: "payment",
      title: "Conto/Pagamento",
      description: isLoading ? "Caricamento..." : 
                   pendingAmount > 0 ? `Rimanente: €${pendingAmount.toFixed(2)}` : "Nessun importo da pagare",
      icon: CreditCard,
      color: "bg-green-500",
      href: `/cameriere/conti?tavolo=${table.numero}`,
      available: table.stato === "OCCUPATO" && pendingAmount > 0
    },
    {
      id: "current-orders",
      title: "Ordini in Corso",
      description: isLoading ? "Caricamento..." : 
                   ordersCount > 0 ? `${ordersCount} ordini attivi` : "Nessun ordine attivo",
      icon: FileText,
      color: "bg-orange-500",
      href: `/cameriere/ordini-in-corso?tavolo=${table.numero}`,
      available: table.stato === "OCCUPATO" && ordersCount > 0
    },
    {
      id: "history",
      title: "Storico Ordini",
      description: "Visualizza tutti gli ordini passati di questo tavolo",
      icon: History,
      color: "bg-purple-500",
      href: `/cameriere/cronologia?tavolo=${table.numero}`,
      available: true
    }
  ];

  const handleActionClick = (action: typeof actions[0]) => {
    onClose();
    // La navigazione sarà gestita dal Link
  };

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tavolo ${table.numero}`}
      size="lg"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Informazioni Tavolo - Layout compatto */}
        <div className="p-2 sm:p-3 rounded-lg border" style={{ 
          backgroundColor: colors.bg.hover,
          borderColor: colors.border.primary 
        }}>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Table number circle */}
            <div 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold"
              style={{
                backgroundColor: colors.text.accent,
                color: 'white'
              }}
            >
              {table.numero}
            </div>
            
            {/* Customer Names */}
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-medium truncate" style={{ color: colors.text.primary }}>
                {table.clienteNome || "Nessun cliente"}
              </div>
              <div className="text-xs sm:text-sm" style={{ color: colors.text.secondary }}>
                {table.zona && `${table.zona} • `}{table.posti} posti
              </div>
            </div>
            
            {/* Table status */}
            <div className="text-right">
              <div className="text-xs sm:text-sm font-medium" style={{ 
                color: table.stato === 'OCCUPATO' ? colors.button.success : colors.text.muted 
              }}>
                {table.stato === 'LIBERO' ? 'Libero' :
                 table.stato === 'OCCUPATO' ? 'Occupato' :
                 table.stato === 'RISERVATO' ? 'Riservato' :
                 'In Pulizia'}
              </div>
              {table.stato === 'OCCUPATO' && ordersCount > 0 && (
                <div className="text-xs" style={{ color: colors.text.secondary }}>
                  {ordersCount} ordini
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert per ordine esaurito */}
        {table.hasOutOfStockOrder && !showOutOfStockManagement && (
          <div className="p-3 rounded-lg border-2 border-red-500 bg-red-500/10">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Ordine con Prodotti Esauriti
                </h4>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                  {outOfStockOrderDetails?.handledBy 
                    ? `Gestito da: ${outOfStockOrderDetails.handledBy}`
                    : table.outOfStockHandledBy 
                      ? `Gestito da: ${table.outOfStockHandledBy}`
                      : "Nessuno sta gestendo questo problema"}
                </p>
              </div>
              <div className="flex gap-2">
                {!table.outOfStockHandledBy && !outOfStockOrderDetails?.handledBy && (
                  <button
                    onClick={async () => {
                      if (table.outOfStockOrders?.[0]) {
                        setLoadingOutOfStock(true);
                        
                        // Aggiorna IMMEDIATAMENTE lo stato locale del tavolo
                        if (onTableUpdate) {
                          onTableUpdate();
                        }
                        
                        try {
                          // Gestisci sia array di stringhe che array di oggetti
                          const orderId = typeof table.outOfStockOrders[0] === 'string' 
                            ? table.outOfStockOrders[0] 
                            : table.outOfStockOrders[0].id;
                          
                          // Prima carica i dettagli dell'ordine
                          const { getOutOfStockOrderDetails } = await import('@/lib/actions/gestione-esauriti');
                          const details = await getOutOfStockOrderDetails(orderId);
                          
                          if (details.success) {
                            // Poi prendi in carico
                            const { takeChargeOfOutOfStockOrder } = await import('@/lib/actions/esaurito-handling');
                            const result = await takeChargeOfOutOfStockOrder(orderId);
                            
                            if (result.success) {
                              // Aggiorna i dettagli con chi lo sta gestendo
                              setOutOfStockOrderDetails({
                                ...details,
                                handledBy: result.takenBy
                              });
                              // Mostra immediatamente la sezione di gestione
                              setShowOutOfStockManagement(true);
                            }
                          }
                        } catch (error) {
                          console.error('Error taking charge:', error);
                          // Se c'è un errore, ricarica i dati per ripristinare lo stato corretto
                          if (onTableUpdate) {
                            onTableUpdate();
                          }
                        } finally {
                          setLoadingOutOfStock(false);
                        }
                      }
                    }}
                    disabled={loadingOutOfStock}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingOutOfStock ? 'Caricamento...' : 'Gestisco io'}
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (table.outOfStockOrders?.[0]) {
                      setLoadingOutOfStock(true);
                      try {
                        // Gestisci sia array di stringhe che array di oggetti
                        const orderId = typeof table.outOfStockOrders[0] === 'string' 
                          ? table.outOfStockOrders[0] 
                          : table.outOfStockOrders[0].id;
                        
                        const { getOutOfStockOrderDetails } = await import('@/lib/actions/gestione-esauriti');
                        const result = await getOutOfStockOrderDetails(orderId);
                        if (result.success) {
                          setOutOfStockOrderDetails(result);
                          // Mostra immediatamente la sezione di gestione
                          setShowOutOfStockManagement(true);
                        }
                      } catch (error) {
                        console.error('Error loading out of stock order:', error);
                      } finally {
                        setLoadingOutOfStock(false);
                      }
                    }
                  }}
                  disabled={loadingOutOfStock}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {loadingOutOfStock ? 'Caricamento...' : 'Dettagli'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gestione ordine esaurito - mostrata quando si clicca "Gestisci Problema" */}
        {showOutOfStockManagement && outOfStockOrderDetails && (
          <div className="space-y-3 p-3 rounded-lg border-2" style={{
            borderColor: colors.border.primary,
            backgroundColor: colors.bg.hover
          }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Gestione Ordine Esaurito
              </h4>
              <button
                onClick={() => {
                  setShowOutOfStockManagement(false);
                  setOutOfStockOrderDetails(null);
                }}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
              >
                <X className="h-4 w-4" style={{ color: colors.text.muted }} />
              </button>
            </div>

            {/* Prodotti esauriti */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-red-600 dark:text-red-400">
                Prodotti Esauriti ({outOfStockOrderDetails.unavailableProducts?.length || 0})
              </h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {outOfStockOrderDetails.unavailableProducts?.map((item: any, index: number) => (
                  <div key={index} className="text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded flex justify-between">
                    <span>{item.Prodotto?.nome}</span>
                    <span>x{item.quantita}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Azioni */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t" style={{ borderColor: colors.border.primary }}>
              <button
                onClick={async () => {
                  // Naviga alla pagina del tavolo per modificare l'ordine
                  // Gestisci sia array di stringhe che array di oggetti
                  const orderId = table.outOfStockOrders?.[0] 
                    ? (typeof table.outOfStockOrders[0] === 'string' 
                        ? table.outOfStockOrders[0] 
                        : table.outOfStockOrders[0].id)
                    : null;
                    
                  if (orderId) {
                    const params = new URLSearchParams({
                      modifyOrder: orderId,
                      excludeProducts: outOfStockOrderDetails.unavailableProducts
                        ?.map((p: any) => p.Prodotto?.id)
                        .filter(Boolean)
                        .join(',') || ''
                    });
                    window.location.href = `/cameriere/tavolo/${table.id}?${params.toString()}`;
                  }
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Edit className="h-4 w-4" />
                Modifica Ordine
              </button>

              {outOfStockOrderDetails.handledBy && (
                <button
                  onClick={async () => {
                    try {
                      // Gestisci sia array di stringhe che array di oggetti
                      const orderId = table.outOfStockOrders?.[0] 
                        ? (typeof table.outOfStockOrders[0] === 'string' 
                            ? table.outOfStockOrders[0] 
                            : table.outOfStockOrders[0].id)
                        : null;
                      
                      if (orderId) {
                        const { releaseOutOfStockOrder } = await import('@/lib/actions/esaurito-handling');
                        const result = await releaseOutOfStockOrder(orderId);
                        if (result.success) {
                          setShowOutOfStockManagement(false);
                          setOutOfStockOrderDetails(null);
                          // Aggiorna i dati del tavolo
                          if (onTableUpdate) {
                            onTableUpdate();
                          }
                          // Non chiudere il modal, solo nascondere la sezione di gestione
                        }
                      }
                    } catch (error) {
                      console.error('Error releasing order:', error);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <UserX className="h-4 w-4" />
                  Rilascia
                </button>
              )}

              <button
                onClick={async () => {
                  if (confirm('Sei sicuro di voler annullare questo ordine esaurito?')) {
                    try {
                      // Gestisci sia array di stringhe che array di oggetti
                      const orderId = table.outOfStockOrders?.[0] 
                        ? (typeof table.outOfStockOrders[0] === 'string' 
                            ? table.outOfStockOrders[0] 
                            : table.outOfStockOrders[0].id)
                        : null;
                      
                      if (orderId) {
                        const { cancelOutOfStockOrder } = await import('@/lib/actions/gestione-esauriti');
                        const result = await cancelOutOfStockOrder(orderId);
                        if (result.success) {
                          setShowOutOfStockManagement(false);
                          setOutOfStockOrderDetails(null);
                          // Aggiorna i dati del tavolo e chiudi il modal solo dopo l'annullamento
                          if (onTableUpdate) {
                            onTableUpdate();
                          }
                          // Chiudi il modal dopo un breve delay per dare feedback visivo
                          setTimeout(() => onClose(), 300);
                        }
                      }
                    } catch (error) {
                      console.error('Error cancelling order:', error);
                    }
                  }
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Annulla Ordine
              </button>
            </div>
          </div>
        )}

        {/* Azioni Disponibili - Card Fuse Style */}
        <div>
          <h4 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3" style={{ color: colors.text.primary }}>
            Operazioni Disponibili
          </h4>
          <div className="space-y-0">
            {actions.map((action, index) => {
              const Icon = action.icon;
              const isFirst = index === 0;
              const isLast = index === actions.length - 1;
              
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  onClick={() => handleActionClick(action)}
                  className={`
                    block p-3 sm:p-4 border-2 border-l-2 border-r-2 transition-all duration-200
                    ${isFirst ? 'rounded-t-2xl border-t-2' : 'border-t-0'}
                    ${isLast ? 'rounded-b-2xl border-b-2' : 'border-b-0'}
                    ${action.available 
                      ? 'hover:z-10 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed pointer-events-none'
                    }
                  `}
                  style={{
                    backgroundColor: action.available ? colors.bg.card : colors.bg.dark,
                    borderColor: action.available ? colors.border.secondary : colors.border.primary,
                    position: 'relative',
                    zIndex: 1
                  }}
                  onMouseEnter={(e) => {
                    if (action.available) {
                      e.currentTarget.style.backgroundColor = colors.bg.hover;
                      e.currentTarget.style.borderColor = colors.text.accent + '60';
                      e.currentTarget.style.zIndex = '10';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (action.available) {
                      e.currentTarget.style.backgroundColor = colors.bg.card;
                      e.currentTarget.style.borderColor = colors.border.secondary;
                      e.currentTarget.style.zIndex = '1';
                    }
                  }}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`p-2 sm:p-2.5 rounded-lg ${action.color} text-white flex-shrink-0`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm sm:text-base font-semibold" style={{ 
                        color: action.available ? colors.text.primary : colors.text.muted 
                      }}>
                        {action.title}
                      </h5>
                      <p className="text-xs sm:text-sm mt-0.5" style={{ 
                        color: action.available ? colors.text.secondary : colors.text.muted 
                      }}>
                        {action.description}
                      </p>
                    </div>
                    {action.available && (
                      <div className="flex-shrink-0">
                        <div className="text-xs sm:text-sm" style={{ color: colors.text.muted }}>
                          →
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions per tavoli occupati */}
        {table.stato === "OCCUPATO" && (
          <div className="pt-2 sm:pt-3 border-t" style={{ borderColor: colors.border.primary }}>
            <div className="flex gap-2 sm:gap-3">
              <Link
                href={`/cameriere/tavolo/${table.id}`}
                onClick={onClose}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg text-center text-sm sm:text-base font-medium transition-colors"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
                Aggiungi Ordine
              </Link>
              {pendingAmount > 0 && (
                <Link
                  href={`/cameriere/conti?tavolo=${table.numero}`}
                  onClick={onClose}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg text-center text-sm sm:text-base font-medium transition-colors"
                >
                  <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
                  Paga Conto
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick Action per tavoli liberi */}
        {table.stato === "LIBERO" && (
          <div className="pt-2 sm:pt-3 border-t" style={{ borderColor: colors.border.primary }}>
            <Link
              href={`/cameriere/tavolo/${table.id}`}
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg text-center text-sm sm:text-base font-medium transition-colors block"
            >
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
              Inizia Nuovo Ordine
            </Link>
          </div>
        )}
      </div>
    </ThemedModal>
  );
}