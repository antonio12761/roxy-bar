"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Users, Euro, Calendar, Search, ChevronDown, ChevronRight, MapPin, Clock, User, CreditCard, CheckCircle, Plus, Minus, X, FileText, History, Filter } from "lucide-react";
import Link from "next/link";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatusIndicator";
import { getOrdinazioniConsegnate } from "@/lib/actions/cassa";
import { creaPagamentoRigheSpecifiche } from "@/lib/actions/pagamenti";
import { richiediPagamento, richiediScontrino } from "@/lib/actions/pagamenti";
import { getTuttiContiScalari, saldaContoParziale } from "@/lib/actions/ordinaPerAltri";
import { toast } from "@/lib/toast";
import PaymentHistory from "@/components/cassa/payment-history";
import { useCameriere } from "@/contexts/cameriere-context";
import { ThemedDrawer } from "@/components/ui/ThemedDrawer";
import { useTheme } from "@/contexts/ThemeContext";
import { Checkbox } from "@/components/ui/checkbox";

interface DeliveredOrder {
  id: string;
  numero: number;
  tavolo: { numero: string } | null;
  tipo: "TAVOLO" | "ASPORTO" | "BANCONE";
  cameriere: { nome: string };
  cliente: { nome: string; telefono: string | null; } | null;
  totale: number;
  pagato: boolean;
  statoPagamento: "NON_PAGATO" | "PARZIALMENTE_PAGATO" | "COMPLETAMENTE_PAGATO";
  stato: string;
  dataConsegna: string;
  dataApertura: Date;
  totalePagamenti: number;
  rimanente: number;
  righePagate: number;
  righeNonPagate: number;
  totaleRighePagate: number;
  totaleRigheNonPagate: number;
  hasPagamentoParziale: boolean;
  righe: Array<{
    id: string;
    prezzo: number;
    quantita: number;
    isPagato: boolean;
    pagatoDa?: string;
    prodotto: { nome: string };
  }>;
  pagamenti: Array<{
    importo: number;
    modalita: string;
  }>;
  nomeCliente?: string | null;
}

interface TableGroup {
  tableNumber: string;
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  partiallyPaidOrders: number;
  fullyPaidOrders: number;
  unpaidOrders: number;
  orders: DeliveredOrder[];
}

interface SelectedItem {
  orderId: string;
  rigaId: string;
  productName: string;
  originalQuantity: number;
  selectedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  customerName: string;
  tableNumber: string;
}

interface GroupedProduct {
  productName: string;
  totalQuantity: number;
  unitPrice: number;
  totalPrice: number;
  items: Array<{
    orderId: string;
    rigaId: string;
    quantity: number;
    customerName: string;
    isPagato: boolean;
    pagatoDa?: string;
  }>;
}

interface ContoScalareData {
  id: string;
  tavoloId?: number | null;
  clienteId?: string | null;
  nomeCliente?: string | null;
  totaleOrdinato: number;
  totalePagato: number;
  saldoRimanente: number;
  dataApertura: Date;
  movimenti: MovimentoContoData[];
}

interface MovimentoContoData {
  id: string;
  tipo: string;
  importo: number;
  descrizione: string;
  timestamp: Date;
  nomeClientePagatore?: string | null;
}

interface RiepilogoConti {
  contiAperti: number;
  totaleOrdinato: number;
  totalePagato: number;
  saldoRimanente: number;
  dettagliConti: ContoScalareData[];
}

type ViewMode = "conti-clienti" | "conti-scalari";

export default function GestioneContiPage() {
  // States
  const [viewMode, setViewMode] = useState<ViewMode>("conti-clienti");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Conti Clienti States
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [totalStats, setTotalStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalUnpaid: 0
  });
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CONTANTI' | 'POS' | null>(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [customerNameForPayment, setCustomerNameForPayment] = useState("");
  const [requestedPaymentItems, setRequestedPaymentItems] = useState<Set<string>>(new Set());
  const lastUpdateRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  
  // Conti Scalari States
  const [riepilogo, setRiepilogo] = useState<RiepilogoConti | null>(null);
  const [selectedConto, setSelectedConto] = useState<ContoScalareData | null>(null);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [importoPagamento, setImportoPagamento] = useState("");
  const [modalitaPagamento, setModalitaPagamento] = useState("CONTANTI");
  
  // Use cameriere context
  const { setIsConnected } = useCameriere();
  
  // Theme context
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  // SSE for real-time updates
  const { notifications, isConnected, connectionHealth } = useEnhancedSSE({
    clientId: "cameriere-gestione-conti",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      if (isInitialLoadRef.current) {
        console.log("⏸️ Skipping notification during initial load");
        return;
      }
      
      console.log("📨 Cameriere received notification:", notification.type, notification);
      
      if (notification.type === "order:delivered" || 
          notification.type === "order:paid" ||
          notification.type === "order_delivered" ||
          notification.type === "payment_completed") {
        const now = Date.now();
        if (now - lastUpdateRef.current > 3000) {
          lastUpdateRef.current = now;
          console.log("🔄 Refreshing after", notification.type);
          if (viewMode === "conti-clienti") {
            fetchDeliveredOrders();
          }
        }
      }
    }
  });

  useEffect(() => {
    if (viewMode === "conti-clienti") {
      fetchDeliveredOrders();
    } else {
      loadContiScalari();
    }
  }, [viewMode]);

  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  // Conti Clienti Functions
  const fetchDeliveredOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getOrdinazioniConsegnate();
      
      const grouped = groupOrdersByTable(data);
      setTableGroups(grouped);
      calculateTotalStats(grouped);
      
      if (isInitialLoadRef.current) {
        setTimeout(() => {
          isInitialLoadRef.current = false;
          console.log("✅ Initial load complete, SSE notifications enabled");
        }, 1000);
      }
    } catch (error) {
      console.error('Error fetching delivered orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupOrdersByTable = (orders: DeliveredOrder[]): TableGroup[] => {
    const groups: { [key: string]: TableGroup } = {};
    
    orders.forEach(order => {
      const tableNumber = order.tavolo?.numero || (order.tipo === 'ASPORTO' ? 'ASPORTO' : order.tipo);
      
      if (!groups[tableNumber]) {
        groups[tableNumber] = {
          tableNumber,
          totalOrders: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          partiallyPaidOrders: 0,
          fullyPaidOrders: 0,
          unpaidOrders: 0,
          orders: []
        };
      }
      
      groups[tableNumber].orders.push(order);
      groups[tableNumber].totalOrders++;
      groups[tableNumber].totalAmount += order.totale;
      groups[tableNumber].totalPaid += order.totalePagamenti;
      groups[tableNumber].totalUnpaid += order.rimanente;
      
      if (order.statoPagamento === 'COMPLETAMENTE_PAGATO') {
        groups[tableNumber].fullyPaidOrders++;
      } else if (order.statoPagamento === 'PARZIALMENTE_PAGATO') {
        groups[tableNumber].partiallyPaidOrders++;
      } else {
        groups[tableNumber].unpaidOrders++;
      }
    });
    
    return Object.values(groups).sort((a, b) => {
      if (a.tableNumber === 'ASPORTO') return 1;
      if (b.tableNumber === 'ASPORTO') return -1;
      if (a.tableNumber === 'BANCONE') return 1;
      if (b.tableNumber === 'BANCONE') return -1;
      return parseInt(a.tableNumber) - parseInt(b.tableNumber);
    });
  };

  const calculateTotalStats = (groups: TableGroup[]) => {
    const stats = groups.reduce((acc, group) => ({
      totalOrders: acc.totalOrders + group.totalOrders,
      totalAmount: acc.totalAmount + group.totalAmount,
      totalPaid: acc.totalPaid + group.totalPaid,
      totalUnpaid: acc.totalUnpaid + group.totalUnpaid
    }), { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalUnpaid: 0 });
    
    setTotalStats(stats);
  };

  const toggleTableExpansion = (tableNumber: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableNumber)) {
      newExpanded.delete(tableNumber);
    } else {
      newExpanded.add(tableNumber);
    }
    setExpandedTables(newExpanded);
  };

  const groupProductsByNameAndPrice = (orders: DeliveredOrder[]) => {
    const grouped: { [key: string]: GroupedProduct } = {};
    
    orders.forEach(order => {
      const customerName = order.nomeCliente || order.cliente?.nome || 'Cliente';
      
      order.righe.forEach((riga: any) => {
        const key = `${riga.prodotto.nome}-${riga.prezzo}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            productName: riga.prodotto.nome,
            totalQuantity: 0,
            unitPrice: riga.prezzo,
            totalPrice: 0,
            items: []
          };
        }
        
        grouped[key].totalQuantity += riga.quantita;
        grouped[key].totalPrice += riga.quantita * riga.prezzo;
        grouped[key].items.push({
          orderId: order.id,
          rigaId: riga.id,
          quantity: riga.quantita,
          customerName,
          isPagato: riga.isPagato,
          pagatoDa: riga.pagatoDa
        });
      });
    });
    
    return Object.values(grouped);
  };

  useEffect(() => {
    if (selectedItems.length > 0 && !drawerExpanded) {
      setDrawerExpanded(true);
    }
  }, [selectedItems.length]);

  const toggleProductSelection = (order: DeliveredOrder, riga: any, quantity: number = 1) => {
    if (riga.isPagato) return;
    
    const itemKey = `${order.id}-${riga.id}`;
    if (requestedPaymentItems.has(itemKey)) return;

    const existingIndex = selectedItems.findIndex(item => 
      item.orderId === order.id && item.rigaId === riga.id
    );

    if (existingIndex >= 0) {
      const newSelectedItems = [...selectedItems];
      newSelectedItems[existingIndex].selectedQuantity = quantity;
      newSelectedItems[existingIndex].totalPrice = quantity * riga.prezzo;
      
      if (quantity <= 0) {
        newSelectedItems.splice(existingIndex, 1);
      }
      
      setSelectedItems(newSelectedItems);
    } else if (quantity > 0) {
      const newItem: SelectedItem = {
        orderId: order.id,
        rigaId: riga.id,
        productName: riga.prodotto.nome,
        originalQuantity: riga.quantita,
        selectedQuantity: quantity,
        unitPrice: riga.prezzo,
        totalPrice: quantity * riga.prezzo,
        customerName: order.cameriere.nome,
        tableNumber: order.tavolo?.numero || 'N/A'
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const toggleOrderSelection = (order: DeliveredOrder) => {
    const unpaidItems = order.righe.filter(riga => !riga.isPagato);
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    const isFullySelected = unpaidItems.length === selectedOrderItems.length && 
      selectedOrderItems.every(selectedItem => 
        selectedItem.selectedQuantity === selectedItem.originalQuantity
      );

    if (isFullySelected) {
      setSelectedItems(prev => prev.filter(item => item.orderId !== order.id));
    } else {
      const newSelectedItems = [...selectedItems.filter(item => item.orderId !== order.id)];
      
      unpaidItems.forEach((riga: any) => {
        const newItem: SelectedItem = {
          orderId: order.id,
          rigaId: riga.id,
          productName: riga.prodotto.nome,
          originalQuantity: riga.quantita,
          selectedQuantity: riga.quantita,
          unitPrice: riga.prezzo,
          totalPrice: riga.quantita * riga.prezzo,
          customerName: order.cameriere.nome,
          tableNumber: order.tavolo?.numero || 'N/A'
        };
        newSelectedItems.push(newItem);
      });
      
      setSelectedItems(newSelectedItems);
    }
  };

  const isOrderFullySelected = (order: DeliveredOrder) => {
    const unpaidItems = order.righe.filter(riga => !riga.isPagato);
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    return unpaidItems.length > 0 && unpaidItems.length === selectedOrderItems.length && 
      selectedOrderItems.every(selectedItem => 
        selectedItem.selectedQuantity === selectedItem.originalQuantity
      );
  };

  const isOrderPartiallySelected = (order: DeliveredOrder) => {
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    return selectedOrderItems.length > 0 && !isOrderFullySelected(order);
  };

  const toggleTableSelection = (group: TableGroup) => {
    const allUnpaidItems: SelectedItem[] = [];
    
    group.orders.forEach(order => {
      const unpaidRighe = order.righe.filter(riga => !riga.isPagato);
      unpaidRighe.forEach(riga => {
        allUnpaidItems.push({
          orderId: order.id,
          rigaId: (riga as any).id || '',
          productName: riga.prodotto.nome,
          originalQuantity: riga.quantita,
          selectedQuantity: riga.quantita,
          unitPrice: riga.prezzo,
          totalPrice: riga.quantita * riga.prezzo,
          customerName: order.cameriere.nome,
          tableNumber: group.tableNumber
        });
      });
    });

    const tableItemsSelected = allUnpaidItems.every(item =>
      selectedItems.some(sel => 
        sel.orderId === item.orderId && sel.rigaId === item.rigaId
      )
    );

    if (tableItemsSelected) {
      const orderIds = group.orders.map(o => o.id);
      setSelectedItems(prev => prev.filter(item => !orderIds.includes(item.orderId)));
    } else {
      setSelectedItems(prev => {
        const newItems = [...prev];
        allUnpaidItems.forEach(item => {
          const existingIndex = newItems.findIndex(sel => 
            sel.orderId === item.orderId && sel.rigaId === item.rigaId
          );
          if (existingIndex === -1) {
            newItems.push(item);
          }
        });
        return newItems;
      });
    }
  };

  const isTableFullySelected = (group: TableGroup) => {
    const unpaidItemsCount = group.orders.reduce((sum, order) => 
      sum + order.righe.filter(riga => !riga.isPagato).length, 0
    );
    
    if (unpaidItemsCount === 0) return false;
    
    const selectedTableItems = selectedItems.filter(item => 
      group.orders.some(order => order.id === item.orderId)
    );
    
    return selectedTableItems.length === unpaidItemsCount;
  };

  const handleWaiterPayment = async () => {
    if (selectedItems.length === 0 || !paymentMethod || !customerNameForPayment.trim()) {
      if (!customerNameForPayment.trim()) {
        toast.error('Inserisci il nome del cliente');
      }
      return;
    }

    setProcessingPayment(true);
    try {
      const totalAmount = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      toast.success(`Pagamento ${paymentMethod} di €${totalAmount.toFixed(2)} ricevuto da ${customerNameForPayment}`);
      
      const itemsForReceipt = selectedItems.map(item => ({
        orderId: item.orderId,
        totalPrice: item.totalPrice
      }));
      
      const result = await richiediScontrino(
        itemsForReceipt,
        totalAmount,
        paymentMethod,
        customerNameForPayment
      );
      
      if (result.success) {
        toast.info('Richiesta scontrino inviata alla cassa');
        
        const newRequestedItems = new Set(requestedPaymentItems);
        selectedItems.forEach(item => {
          newRequestedItems.add(`${item.orderId}-${item.rigaId}`);
        });
        setRequestedPaymentItems(newRequestedItems);
      } else {
        toast.error(result.error || 'Errore invio richiesta scontrino');
      }
      
      setSelectedItems([]);
      setShowPaymentModal(false);
      setPaymentMethod(null);
      setCustomerNameForPayment("");
      
      await fetchDeliveredOrders();
    } catch (error) {
      console.error('Errore gestione pagamento:', error);
      toast.error('Errore durante il pagamento');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Conti Scalari Functions
  const loadContiScalari = async () => {
    setIsLoading(true);
    try {
      console.log("Caricamento conti scalari...");
      const result = await getTuttiContiScalari();
      
      if (result.success && result.riepilogo) {
        setRiepilogo(result.riepilogo);
        console.log("✅ Conti scalari caricati:", result.riepilogo);
      } else {
        console.error("❌ Errore caricamento conti scalari:", result.error);
        toast.error(result.error || "Errore nel caricamento dei conti scalari");
        setRiepilogo(null);
      }
    } catch (error) {
      console.error("❌ Errore caricamento conti scalari:", error);
      toast.error("Errore nel caricamento dei conti scalari");
      setRiepilogo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePagamentoScalare = async () => {
    if (!selectedConto || !importoPagamento) return;

    const importo = parseFloat(importoPagamento);
    if (isNaN(importo) || importo <= 0) {
      toast.error("Inserire un importo valido");
      return;
    }

    try {
      const result = await saldaContoParziale(
        selectedConto.id,
        importo,
        undefined,
        modalitaPagamento
      );

      if (result.success) {
        toast.success(result.message || "Pagamento registrato con successo");
        setShowPagamentoModal(false);
        setImportoPagamento("");
        setSelectedConto(null);
        loadContiScalari();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Errore pagamento:", error);
      toast.error("Errore durante il pagamento");
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTipoMovimentoColor = (tipo: string) => {
    switch (tipo) {
      case 'ORDINE': return colors.text.error;
      case 'PAGAMENTO': return colors.text.success;
      case 'STORNO': return colors.status?.warning || colors.text.accent;
      default: return colors.text.muted;
    }
  };

  const getTipoMovimentoIcon = (tipo: string) => {
    switch (tipo) {
      case 'ORDINE': return <Plus className="h-4 w-4" />;
      case 'PAGAMENTO': return <Minus className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const filteredTableGroups = tableGroups.filter(group => 
    group.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.orders.some(order => 
      order.cameriere.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredContiScalari = riepilogo?.dettagliConti.filter(conto => 
    (conto.nomeCliente?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (conto.tavoloId?.toString().includes(searchTerm) || false)
  ) || [];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: colors.bg.main }}>
      {/* Page Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/cameriere" 
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
            </Link>
            <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
              Gestione Conti
            </h1>
            
            <span className="text-base" style={{ color: colors.text.secondary }}>
              {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
          </div>
          <div className="flex items-center gap-2">
            {viewMode === "conti-clienti" && (
              <button
                onClick={() => setShowPaymentHistory(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }}
              >
                <History className="h-4 w-4" style={{ color: colors.text.secondary }} />
                <span className="font-medium" style={{ color: colors.text.secondary }}>Storico</span>
              </button>
            )}
            <ConnectionStatusIndicator 
              connectionHealth={connectionHealth}
            />
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.secondary }}>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("conti-clienti")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "conti-clienti" ? '' : ''
            }`}
            style={{
              backgroundColor: viewMode === "conti-clienti" ? colors.accent : 'transparent',
              color: viewMode === "conti-clienti" ? colors.button.primaryText : colors.text.secondary,
              border: `1px solid ${viewMode === "conti-clienti" ? colors.accent : colors.border.primary}`
            }}
          >
            Conti Clienti
          </button>
          <button
            onClick={() => setViewMode("conti-scalari")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "conti-scalari" ? '' : ''
            }`}
            style={{
              backgroundColor: viewMode === "conti-scalari" ? colors.accent : 'transparent',
              color: viewMode === "conti-scalari" ? colors.button.primaryText : colors.text.secondary,
              border: `1px solid ${viewMode === "conti-scalari" ? colors.accent : colors.border.primary}`
            }}
          >
            Conti Scalari
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
            <input
              type="text"
              placeholder={viewMode === "conti-clienti" ? "Cerca per tavolo o cameriere..." : "Cerca per cliente o tavolo..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: colors.text.primary,
                // focusRingColor: colors.accent
              }}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div style={{ color: colors.text.muted }}>Caricamento conti...</div>
          </div>
        ) : (
          <>
            {/* Conti Clienti View */}
            {viewMode === "conti-clienti" && (
              <>
                <div className="space-y-4">
                  {filteredTableGroups.map((group) => (
                    <div 
                      key={group.tableNumber} 
                      className="rounded-lg transition-all duration-200"
                      style={{
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                    >
                      <div 
                        className="p-6 transition-colors cursor-pointer"
                        onClick={() => toggleTableExpansion(group.tableNumber)}
                        style={{ 
                          backgroundColor: expandedTables.has(group.tableNumber) ? colors.bg.darker : colors.bg.card 
                        }}
                        onMouseEnter={(e) => {
                          if (!expandedTables.has(group.tableNumber)) {
                            e.currentTarget.style.backgroundColor = colors.bg.hover;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!expandedTables.has(group.tableNumber)) {
                            e.currentTarget.style.backgroundColor = colors.bg.card;
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isTableFullySelected(group)}
                              onCheckedChange={() => toggleTableSelection(group)}
                              onClick={(e) => e.stopPropagation()}
                              title="Seleziona tutto il tavolo"
                              disabled={group.unpaidOrders === 0}
                              style={{
                                '--border': colors.border.primary,
                                '--primary': colors.accent
                              } as React.CSSProperties}
                            />
                            <div className="flex items-center gap-2">
                              {expandedTables.has(group.tableNumber) ? 
                                <ChevronDown className="h-4 w-4" style={{ color: colors.text.secondary }} /> : 
                                <ChevronRight className="h-4 w-4" style={{ color: colors.text.secondary }} />
                              }
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                                  {group.tableNumber === 'ASPORTO' ? 'Asporto' : 
                                   group.tableNumber === 'BANCONE' ? 'Bancone' : 
                                   `Tavolo ${group.tableNumber}`}
                                </span>
                                <span 
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium"
                                  style={{ 
                                    backgroundColor: colors.accent + '20',
                                    color: colors.accent,
                                    border: `1px solid ${colors.accent}`
                                  }}
                                >
                                  {group.totalOrders}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {group.totalPaid > 0 ? (
                              <>
                                <div className="text-xl font-bold" style={{ color: colors.accent }}>
                                  €{group.totalUnpaid.toFixed(2)}
                                </div>
                                <div className="text-sm line-through" style={{ color: colors.text.error, textDecorationColor: colors.text.error }}>
                                  €{group.totalAmount.toFixed(2)}
                                </div>
                              </>
                            ) : (
                              <div className="text-xl font-bold" style={{ color: colors.text.primary }}>
                                €{group.totalAmount.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {expandedTables.has(group.tableNumber) && (
                        <div className="p-4 sm:p-5 pt-0" style={{ borderTop: `1px solid ${colors.border.secondary}` }}>
                          {group.orders.map((order: any, index: number) => {
                            const waiterName = order.cameriere.nome;
                            const customerName = order.nomeCliente || order.cliente?.nome || 'Cliente';
                            const orderTotal = order.totale;
                            
                            return (
                              <div key={order.id} className="py-3" style={{ borderTop: index > 0 ? `1px solid ${colors.border.secondary}` : 'none' }}>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={isOrderFullySelected(order)}
                                      onCheckedChange={() => toggleOrderSelection(order)}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Seleziona ordinazione per pagamento"
                                      disabled={order.righeNonPagate === 0}
                                      style={{
                                        '--border': colors.border.primary,
                                        '--primary': colors.accent
                                      } as React.CSSProperties}
                                    />
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4" style={{ color: colors.text.secondary }} />
                                      <span className="font-medium" style={{ color: colors.text.primary }}>{waiterName}</span>
                                      <span style={{ color: colors.text.muted }}>•</span>
                                      <div className="flex items-center gap-1" style={{ color: colors.text.muted }}>
                                        <Clock className="h-3 w-3" />
                                        <span className="text-sm">
                                          {new Date(order.dataConsegna).toLocaleTimeString('it-IT', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                      <span style={{ color: colors.text.muted }}>•</span>
                                      <span className="text-sm font-medium" style={{ color: colors.accent }}>
                                        {customerName}
                                      </span>
                                    </div>
                                    {order.statoPagamento === 'PARZIALMENTE_PAGATO' && (
                                      <span className="text-xs px-2 py-1 rounded"
                                        style={{ 
                                          backgroundColor: colors.status?.warning ? colors.status.warning + '20' : '#FFA50020',
                                          color: colors.status?.warning || '#FFA500'
                                        }}>
                                        Parziale
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-sm font-bold" style={{ color: colors.text.secondary }}>
                                    €{orderTotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          
                          <div className="pt-2">
                            <div className="space-y-2">
                              {groupProductsByNameAndPrice(group.orders).map((product, index) => {
                                let selectedQuantity = 0;
                                product.items.forEach(item => {
                                  const selected = selectedItems.find(sel => 
                                    sel.orderId === item.orderId && sel.rigaId === item.rigaId
                                  );
                                  if (selected) {
                                    selectedQuantity += selected.selectedQuantity;
                                  }
                                });
                                
                                const productKey = `${group.tableNumber}-${index}`;
                                const isProductExpanded = expandedProducts.has(productKey);
                                const hasUnpaidItems = product.items.some(item => !item.isPagato && !requestedPaymentItems.has(`${item.orderId}-${item.rigaId}`));
                                const paidQuantity = product.items.filter(item => item.isPagato).reduce((sum, item) => sum + item.quantity, 0);
                                const unpaidQuantity = product.items.filter(item => !item.isPagato && !requestedPaymentItems.has(`${item.orderId}-${item.rigaId}`)).reduce((sum, item) => sum + item.quantity, 0);
                                const requestedQuantity = product.items.filter(item => requestedPaymentItems.has(`${item.orderId}-${item.rigaId}`)).reduce((sum, item) => sum + item.quantity, 0);
                                const isFullyPaid = unpaidQuantity === 0;
                                
                                return (
                                  <div key={index} className="space-y-1">
                                    <div 
                                      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                        product.items.length > 1 && hasUnpaidItems ? 'cursor-pointer' : ''
                                      }`}
                                      style={{
                                        backgroundColor: isFullyPaid ? colors.bg.darker + '60' :
                                          selectedQuantity > 0 ? colors.accent + '20' : 'transparent',
                                        borderColor: selectedQuantity > 0 ? colors.accent : 'transparent',
                                        borderWidth: selectedQuantity > 0 ? '1px' : '0',
                                        borderStyle: 'solid',
                                        opacity: isFullyPaid ? 0.6 : 1
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isFullyPaid && selectedQuantity === 0) {
                                          e.currentTarget.style.backgroundColor = colors.bg.hover;
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isFullyPaid && selectedQuantity === 0) {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                      }}
                                      onClick={() => {
                                        if (product.items.length > 1) {
                                          setExpandedProducts(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(productKey)) {
                                              newSet.delete(productKey);
                                            } else {
                                              newSet.add(productKey);
                                            }
                                            return newSet;
                                          });
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        {hasUnpaidItems && (
                                          <Checkbox
                                            checked={selectedQuantity === product.items.filter(item => !item.isPagato).reduce((sum, item) => sum + item.quantity, 0)}
                                            onCheckedChange={(checked) => {
                                              const unpaidItems = product.items.filter(item => !item.isPagato);
                                              const totalUnpaidQty = unpaidItems.reduce((sum, item) => sum + item.quantity, 0);
                                              
                                              if (selectedQuantity === totalUnpaidQty) {
                                                unpaidItems.forEach(item => {
                                                  const order = group.orders.find((o: any) => o.id === item.orderId);
                                                  const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                                  if (order && riga) {
                                                    toggleProductSelection(order, riga, 0);
                                                  }
                                                });
                                              } else {
                                                unpaidItems.forEach(item => {
                                                  const order = group.orders.find((o: any) => o.id === item.orderId);
                                                  const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                                  if (order && riga) {
                                                    toggleProductSelection(order, riga, item.quantity);
                                                  }
                                                });
                                              }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            title="Seleziona tutti i prodotti del gruppo"
                                          />
                                        )}
                                        {product.items.length > 1 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedProducts(prev => {
                                                const newSet = new Set(prev);
                                                if (newSet.has(productKey)) {
                                                  newSet.delete(productKey);
                                                } else {
                                                  newSet.add(productKey);
                                                }
                                                return newSet;
                                              });
                                            }}
                                            className="p-0.5"
                                          >
                                            {isProductExpanded ? (
                                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                          </button>
                                        )}
                                        <span className="text-sm font-medium w-8">
                                          {product.totalQuantity}x
                                        </span>
                                        <span className={`text-sm ${isFullyPaid ? 'line-through text-muted-foreground' : ''}`}>{product.productName}</span>
                                        {!hasUnpaidItems && unpaidQuantity === 0 && requestedQuantity === 0 && (
                                          <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                                            ✓ Tutto Pagato
                                          </span>
                                        )}
                                        {requestedQuantity > 0 && (
                                          <span className="text-xs px-2 py-1 rounded ml-2"
                                            style={{ 
                                              backgroundColor: colors.status?.warning ? colors.status.warning + '20' : '#FFA50020',
                                              color: colors.status?.warning || '#FFA500'
                                            }}>
                                            ⏳ In pagamento
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="text-sm font-medium">
                                          €{product.totalPrice.toFixed(2)}
                                        </span>
                                        {paidQuantity > 0 && (
                                          <div className="text-xs text-muted-foreground">
                                            {paidQuantity}x pagato
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {isProductExpanded && product.items.length > 1 && (
                                      <div className="ml-8 space-y-1 border-l-2 border-gray-200 pl-4">
                                        {product.items.map((item, itemIndex) => {
                                          const order = group.orders.find((o: any) => o.id === item.orderId);
                                          const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                          const selected = selectedItems.find(sel => 
                                            sel.orderId === item.orderId && sel.rigaId === item.rigaId
                                          );
                                          const isSelected = selected && selected.selectedQuantity > 0;
                                          
                                          return (
                                            <div
                                              key={itemIndex}
                                              className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
                                                item.isPagato ? 'bg-muted/10 opacity-60' : 'hover:bg-muted/20'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2">
                                                {!item.isPagato && (
                                                  <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => {
                                                      if (order && riga) {
                                                        toggleProductSelection(order, riga, isSelected ? 0 : item.quantity);
                                                      }
                                                    }}
                                                    className="h-3 w-3"
                                                  />
                                                )}
                                                <span className={`text-xs ${item.isPagato ? 'line-through' : ''} text-muted-foreground`}>
                                                  {item.quantity}x - {item.customerName}
                                                </span>
                                                {item.isPagato && item.pagatoDa && (
                                                  <span className="text-xs bg-green-600/20 text-green-400 px-1 rounded" title={`Pagato da: ${item.pagatoDa}`}>
                                                    ✓ {item.pagatoDa}
                                                  </span>
                                                )}
                                                {!item.isPagato && requestedPaymentItems.has(`${item.orderId}-${item.rigaId}`) && (
                                                  <span className="text-xs px-1 rounded ml-1"
                                                    style={{ 
                                                      backgroundColor: colors.status?.warning ? colors.status.warning + '20' : '#FFA50020',
                                                      color: colors.status?.warning || '#FFA500'
                                                    }}>
                                                    ⏳ In pagamento
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-xs font-medium">
                                                €{(item.quantity * product.unitPrice).toFixed(2)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {filteredTableGroups.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nessuna ordinazione consegnata trovata</p>
                  </div>
                )}
              </>
            )}

            {/* Conti Scalari View */}
            {viewMode === "conti-scalari" && (
              <>
                {!riepilogo || riepilogo.dettagliConti.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.muted }} className="text-lg">Nessun conto scalare aperto</p>
                    <p className="text-sm mt-2" style={{ color: colors.text.muted }}>
                      I conti scalari vengono creati automaticamente quando si ordinano prodotti per altri
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Riepilogo generale */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="rounded-lg p-4" style={{ 
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}>
                        <div className="text-sm" style={{ color: colors.text.muted }}>Conti Aperti</div>
                        <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>{riepilogo.contiAperti}</div>
                      </div>
                      <div className="rounded-lg p-4" style={{ 
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}>
                        <div className="text-sm" style={{ color: colors.text.muted }}>Totale Ordinato</div>
                        <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>€{riepilogo.totaleOrdinato.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg p-4" style={{ 
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}>
                        <div className="text-sm" style={{ color: colors.text.muted }}>Totale Pagato</div>
                        <div className="text-2xl font-bold" style={{ color: colors.text.success }}>€{riepilogo.totalePagato.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg p-4" style={{ 
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}>
                        <div className="text-sm" style={{ color: colors.text.muted }}>Saldo Rimanente</div>
                        <div className="text-2xl font-bold" style={{ color: colors.text.error }}>€{riepilogo.saldoRimanente.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Lista conti */}
                    <div className="space-y-4">
                      {filteredContiScalari.map((conto) => (
                        <div key={conto.id} className="rounded-lg p-4" style={{ 
                          backgroundColor: colors.bg.card,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {conto.tavoloId ? (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-5 w-5" style={{ color: colors.text.secondary }} />
                                  <span className="font-medium" style={{ color: colors.text.primary }}>Tavolo {conto.tavoloId}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <User className="h-5 w-5" style={{ color: colors.text.secondary }} />
                                  <span className="font-medium" style={{ color: colors.text.primary }}>{conto.nomeCliente}</span>
                                </div>
                              )}
                              <div className="text-sm" style={{ color: colors.text.muted }}>
                                <Clock className="h-4 w-4 inline mr-1" />
                                {formatDate(conto.dataApertura)}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-sm" style={{ color: colors.text.muted }}>Saldo rimanente</div>
                                <div className="text-lg font-bold" style={{ color: colors.text.error }}>€{conto.saldoRimanente.toFixed(2)}</div>
                              </div>
                              {conto.saldoRimanente > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedConto(conto);
                                    setShowPagamentoModal(true);
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                  Incassa
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Dettagli conto */}
                          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                            <div>
                              <span style={{ color: colors.text.muted }}>Ordinato: </span>
                              <span style={{ color: colors.text.primary }}>€{conto.totaleOrdinato.toFixed(2)}</span>
                            </div>
                            <div>
                              <span style={{ color: colors.text.muted }}>Pagato: </span>
                              <span style={{ color: colors.text.success }}>€{conto.totalePagato.toFixed(2)}</span>
                            </div>
                            <div>
                              <span style={{ color: colors.text.muted }}>Movimenti: </span>
                              <span style={{ color: colors.text.primary }}>{conto.movimenti.length}</span>
                            </div>
                          </div>

                          {/* Ultimi movimenti */}
                          {conto.movimenti.length > 0 && (
                            <div className="pt-3" style={{ borderTop: `1px solid ${colors.border.secondary}` }}>
                              <div className="text-sm mb-2" style={{ color: colors.text.muted }}>Ultimi movimenti:</div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {conto.movimenti.slice(0, 3).map((movimento) => (
                                  <div key={movimento.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <span style={{ color: getTipoMovimentoColor(movimento.tipo) }}>
                                        {getTipoMovimentoIcon(movimento.tipo)}
                                      </span>
                                      <span style={{ color: colors.text.primary }}>{movimento.descrizione}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-medium" style={{ 
                                        color: movimento.tipo === 'ORDINE' ? colors.text.error : colors.text.success 
                                      }}>
                                        {movimento.tipo === 'ORDINE' ? '+' : ''}€{Math.abs(movimento.importo).toFixed(2)}
                                      </span>
                                      <div className="text-xs" style={{ color: colors.text.muted }}>
                                        {formatDate(movimento.timestamp)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Payment Drawer - Visible when items are selected (Conti Clienti) */}
      {viewMode === "conti-clienti" && selectedItems.length > 0 && (
        <ThemedDrawer
          isOpen={drawerExpanded}
          onToggle={() => setDrawerExpanded(!drawerExpanded)}
          maxHeight="max-h-[400px]"
          headerContent={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: colors.text.primary }}>
                  {selectedItems.length} prodott{selectedItems.length === 1 ? 'o' : 'i'} selezionat{selectedItems.length === 1 ? 'o' : 'i'}
                </span>
              </div>
              <span className="text-lg font-bold" style={{ color: colors.text.primary }}>
                €{selectedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
              </span>
            </div>
          }
        >
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              {Object.entries(
                selectedItems.reduce((acc, item) => {
                  const key = `${item.productName}`;
                  if (!acc[key]) {
                    acc[key] = { quantity: 0, price: 0 };
                  }
                  acc[key].quantity += item.selectedQuantity;
                  acc[key].price += item.totalPrice;
                  return acc;
                }, {} as Record<string, { quantity: number; price: number }>)
              ).map(([product, data]) => (
                <div key={product} className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: colors.bg.darker }}>
                  <span style={{ color: colors.text.primary }}>
                    {data.quantity}x {product}
                  </span>
                  <span className="font-medium" style={{ color: colors.text.primary }}>
                    €{data.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => {
                  setPaymentMethod('CONTANTI');
                  setShowPaymentModal(true);
                }}
                disabled={processingPayment}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Euro className="h-5 w-5" />
                <span className="font-medium">Paga in Contanti</span>
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('POS');
                  setShowPaymentModal(true);
                }}
                disabled={processingPayment}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <CreditCard className="h-5 w-5" />
                <span className="font-medium">Paga con POS</span>
              </button>
              <button
                onClick={() => {
                  setSelectedItems([]);
                  setDrawerExpanded(false);
                }}
                className="w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  color: colors.text.secondary
                }}
              >
                <X className="h-5 w-5" />
                <span className="font-medium">Annulla Selezione</span>
              </button>
            </div>
          </div>
        </ThemedDrawer>
      )}

      {/* Payment Confirmation Modal (Conti Clienti) */}
      {showPaymentModal && viewMode === "conti-clienti" && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="rounded-lg p-6 w-96 max-w-[90vw]"
            style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>
              Conferma Pagamento {paymentMethod === 'CONTANTI' ? 'in Contanti' : 'con POS'}
            </h3>
            
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.bg.darker }}>
              <div className="text-sm mb-1" style={{ color: colors.text.muted }}>Totale da incassare</div>
              <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                €{selectedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Nome Cliente *
              </label>
              <input
                type="text"
                value={customerNameForPayment}
                onChange={(e) => setCustomerNameForPayment(e.target.value)}
                placeholder="Inserisci il nome del cliente"
                className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
                autoFocus
              />
            </div>

            {paymentMethod === 'CONTANTI' && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400">
                  Ricevi i contanti dal cliente e conferma il pagamento
                </p>
              </div>
            )}

            {paymentMethod === 'POS' && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  Procedi con il pagamento POS e conferma quando completato
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleWaiterPayment}
                disabled={processingPayment}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground rounded-lg flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Conferma Pagamento
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentMethod(null);
                  setCustomerNameForPayment("");
                }}
                disabled={processingPayment}
                className="px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.bg.darker,
                  color: colors.text.secondary
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per pagamento (Conti Scalari) */}
      {showPagamentoModal && selectedConto && viewMode === "conti-scalari" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg w-full max-w-md" style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${colors.border.secondary}` }}>
              <h3 className="text-lg font-bold" style={{ color: colors.text.primary }}>Registra Pagamento</h3>
              <button 
                onClick={() => {
                  setShowPagamentoModal(false);
                  setImportoPagamento("");
                }}
                className="p-2 rounded-lg hover:bg-opacity-80"
                style={{ backgroundColor: colors.bg.hover }}
              >
                <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm" style={{ color: colors.text.muted }}>Conto:</div>
                <div className="font-medium" style={{ color: colors.text.primary }}>
                  {selectedConto.tavoloId ? `Tavolo ${selectedConto.tavoloId}` : selectedConto.nomeCliente}
                </div>
                <div className="text-sm" style={{ color: colors.text.muted }}>
                  Saldo rimanente: €{selectedConto.saldoRimanente.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>Importo da incassare</label>
                <input
                  type="number"
                  step="0.01"
                  value={importoPagamento}
                  onChange={(e) => setImportoPagamento(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: colors.text.primary
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>Modalità di pagamento</label>
                <select
                  value={modalitaPagamento}
                  onChange={(e) => setModalitaPagamento(e.target.value)}
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: colors.text.primary
                  }}
                >
                  <option value="CONTANTI">Contanti</option>
                  <option value="CARTA">Carta</option>
                  <option value="BANCOMAT">Bancomat</option>
                  <option value="SATISPAY">Satispay</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowPagamentoModal(false);
                    setImportoPagamento("");
                  }}
                  className="flex-1 px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.bg.darker,
                    color: colors.text.secondary
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handlePagamentoScalare}
                  disabled={!importoPagamento || parseFloat(importoPagamento) <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Incassa €{importoPagamento || "0.00"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      <PaymentHistory 
        isOpen={showPaymentHistory}
        onClose={() => setShowPaymentHistory(false)}
      />
    </div>
  );
}