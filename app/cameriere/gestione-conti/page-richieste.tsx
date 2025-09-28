"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Users, Euro, Search, Clock, User, CheckCircle, X, History, Smartphone, Building2, CreditCard, Coins, Receipt, ShoppingBag, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatusIndicator";
import { getOrdinazioniConsegnate } from "@/lib/actions/cassa";
import { creaRichiestaPagamento } from "@/lib/actions/richieste-pagamento";
import { toast } from "@/lib/toast";
import PaymentHistory from "@/components/cassa/payment-history";
import { useCameriere } from "@/contexts/cameriere-context";
import { useTheme } from "@/contexts/ThemeContext";
import PaymentMethodGrid, { PaymentMethod } from "@/components/cameriere/PaymentMethodGrid";

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

// Step types for the payment flow
type PaymentStep = 'select-table' | 'select-items' | 'payment-details';

interface SelectedItem {
  orderId: string;
  rigaId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function GestioneContiPageV2() {
  // States
  const [isLoading, setIsLoading] = useState(true);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  
  // Payment flow states
  const [currentStep, setCurrentStep] = useState<PaymentStep>('select-table');
  const [selectedTable, setSelectedTable] = useState<TableGroup | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Quick actions
  const [quickPayMode, setQuickPayMode] = useState<'table' | 'selection' | null>(null);
  
  // Refs
  const lastUpdateRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  
  // Context
  const { setIsConnected } = useCameriere();
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  // SSE for real-time updates
  const { isConnected, connectionHealth } = useEnhancedSSE({
    clientId: "cameriere-gestione-conti-v2",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      if (isInitialLoadRef.current) return;
      
      if (notification.type === "order:delivered" || 
          notification.type === "order:paid" ||
          notification.type === "payment_completed") {
        const now = Date.now();
        if (now - lastUpdateRef.current > 3000) {
          lastUpdateRef.current = now;
          fetchDeliveredOrders();
        }
      }
    }
  });

  useEffect(() => {
    fetchDeliveredOrders();
  }, []);

  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  const fetchDeliveredOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getOrdinazioniConsegnate();
      const grouped = groupOrdersByTable(data);
      setTableGroups(grouped);
      
      // Extract unique customer names for suggestions
      const names = new Set<string>();
      data.forEach(order => {
        if (order.nomeCliente) names.add(order.nomeCliente);
        if (order.cliente?.nome) names.add(order.cliente.nome);
      });
      setCustomerSuggestions(Array.from(names).sort());
      
      if (isInitialLoadRef.current) {
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 1000);
      }
    } catch (error) {
      console.error('Error fetching delivered orders:', error);
      toast.error('Errore nel caricamento degli ordini');
    } finally {
      setIsLoading(false);
    }
  };

  const groupOrdersByTable = (orders: DeliveredOrder[]): TableGroup[] => {
    const groups: { [key: string]: TableGroup } = {};
    
    orders.forEach(order => {
      const tableNumber = order.tavolo?.numero || (order.tipo === 'ASPORTO' ? 'ASPORTO' : 'BANCONE');
      
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
      const aNum = parseInt(a.tableNumber);
      const bNum = parseInt(b.tableNumber);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.tableNumber.localeCompare(b.tableNumber);
    });
  };

  const handleTableSelect = (table: TableGroup) => {
    if (table.totalUnpaid === 0) {
      toast.info('Questo tavolo è già stato completamente pagato');
      return;
    }
    setSelectedTable(table);
    setCurrentStep('select-items');
    setQuickPayMode(null);
  };

  const handleQuickPayTable = (table: TableGroup) => {
    if (table.totalUnpaid === 0) {
      toast.info('Questo tavolo è già stato completamente pagato');
      return;
    }
    
    // Select all unpaid items
    const items: SelectedItem[] = [];
    table.orders.forEach(order => {
      order.righe.filter(r => !r.isPagato).forEach(riga => {
        items.push({
          orderId: order.id,
          rigaId: riga.id,
          productName: riga.prodotto.nome,
          quantity: riga.quantita,
          unitPrice: riga.prezzo,
          totalPrice: riga.quantita * riga.prezzo
        });
      });
    });
    
    setSelectedTable(table);
    setSelectedItems(items);
    setQuickPayMode('table');
    setCurrentStep('payment-details');
  };

  const toggleItemSelection = (order: DeliveredOrder, riga: any) => {
    if (riga.isPagato) return;
    
    const itemKey = `${order.id}-${riga.id}`;
    const existingIndex = selectedItems.findIndex(item => 
      item.orderId === order.id && item.rigaId === riga.id
    );

    if (existingIndex >= 0) {
      setSelectedItems(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      const newItem: SelectedItem = {
        orderId: order.id,
        rigaId: riga.id,
        productName: riga.prodotto.nome,
        quantity: riga.quantita,
        unitPrice: riga.prezzo,
        totalPrice: riga.quantita * riga.prezzo
      };
      setSelectedItems(prev => [...prev, newItem]);
    }
  };

  const handlePaymentRequest = async () => {
    if (!paymentMethod || !customerName.trim() || selectedItems.length === 0) {
      if (!customerName.trim()) toast.error('Inserisci il nome del cliente');
      if (!paymentMethod) toast.error('Seleziona un metodo di pagamento');
      return;
    }

    setIsProcessingPayment(true);
    try {
      // Group items by order
      const orderGroups = selectedItems.reduce((acc, item) => {
        if (!acc[item.orderId]) acc[item.orderId] = [];
        acc[item.orderId].push(item);
        return acc;
      }, {} as Record<string, SelectedItem[]>);

      // Send payment request for each order
      const orderIds = Object.keys(orderGroups);
      let successCount = 0;
      
      for (const orderId of orderIds) {
        const items = orderGroups[orderId];
        const righeSelezionate = items.map(item => item.rigaId);
        
        const result = await creaRichiestaPagamento(
          orderId,
          paymentMethod as any,
          customerName,
          righeSelezionate
        );
        
        if (result.success) {
          successCount++;
        } else {
          toast.error(`Errore richiesta: ${'error' in result ? result.error : 'Errore sconosciuto'}`);
        }
      }
      
      if (successCount > 0) {
        const totalAmount = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        toast.success(
          `✅ Richiesta di pagamento inviata alla cassa!\n` +
          `💰 Importo: €${totalAmount.toFixed(2)}\n` +
          `👤 Cliente: ${customerName}\n` +
          `💳 Modalità: ${paymentMethod}`
        );
      }
      
      // Reset state
      resetPaymentFlow();
      await fetchDeliveredOrders();
    } catch (error) {
      console.error('Errore invio richiesta pagamento:', error);
      toast.error('Errore durante l\'invio della richiesta');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const resetPaymentFlow = () => {
    setCurrentStep('select-table');
    setSelectedTable(null);
    setSelectedItems([]);
    setPaymentMethod(null);
    setCustomerName("");
    setQuickPayMode(null);
    setShowSuggestions(false);
  };

  const getTotalSelected = () => {
    return selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const filteredTableGroups = tableGroups.filter(group => 
    group.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.orders.some(order => 
      order.cameriere.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.nomeCliente?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETAMENTE_PAGATO':
        return colors.text.success;
      case 'PARZIALMENTE_PAGATO':
        return colors.status?.warning || '#FFA500';
      default:
        return colors.text.error;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETAMENTE_PAGATO':
        return { text: 'Pagato', bgColor: colors.text.success + '20', color: colors.text.success };
      case 'PARZIALMENTE_PAGATO':
        return { text: 'Parziale', bgColor: (colors.status?.warning || '#FFA500') + '20', color: colors.status?.warning || '#FFA500' };
      default:
        return { text: 'Da pagare', bgColor: colors.text.error + '20', color: colors.text.error };
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b" style={{ backgroundColor: colors.bg.main, borderColor: colors.border.primary }}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStep !== 'select-table' ? (
                <button 
                  onClick={currentStep === 'payment-details' ? () => setCurrentStep('select-items') :
                          resetPaymentFlow}
                  className="p-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
                </button>
              ) : (
                <Link 
                  href="/cameriere" 
                  className="p-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
                </Link>
              )}
              
              <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                {currentStep === 'select-table' && 'Gestione Conti'}
                {currentStep === 'select-items' && `${selectedTable?.tableNumber === 'ASPORTO' ? 'Asporto' : 
                  selectedTable?.tableNumber === 'BANCONE' ? 'Bancone' : 
                  `Tavolo ${selectedTable?.tableNumber}`} - Seleziona Prodotti`}
                {currentStep === 'payment-details' && 'Richiesta Pagamento alla Cassa'}
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              {currentStep === 'select-table' && (
                <button
                  onClick={() => setShowPaymentHistory(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  <History className="h-4 w-4" style={{ color: colors.text.secondary }} />
                  <span className="font-medium hidden sm:inline" style={{ color: colors.text.secondary }}>Storico</span>
                </button>
              )}
              <ConnectionStatusIndicator connectionHealth={connectionHealth} />
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {currentStep !== 'select-table' && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className={`w-8 h-1 rounded-full transition-colors`} 
                  style={{ backgroundColor: colors.accent }} />
                <div className={`w-8 h-1 rounded-full transition-colors`} 
                  style={{ backgroundColor: currentStep !== 'select-items' ? colors.accent : colors.border.secondary }} />
              </div>
              
              {selectedItems.length > 0 && (
                <span className="ml-auto text-sm font-medium" style={{ color: colors.text.secondary }}>
                  {selectedItems.length} prodott{selectedItems.length === 1 ? 'o' : 'i'} • €{getTotalSelected().toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.muted }} />
          </div>
        ) : (
          <>
            {/* Step 1: Select Table */}
            {currentStep === 'select-table' && (
              <>
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
                    <input
                      type="text"
                      placeholder="Cerca tavolo, cameriere o cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.bg.input,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        color: colors.text.primary
                      }}
                    />
                  </div>
                </div>

                {/* Tables Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTableGroups.map((group) => {
                    const badge = group.unpaidOrders > 0 ? getPaymentStatusBadge('NON_PAGATO') :
                                 group.partiallyPaidOrders > 0 ? getPaymentStatusBadge('PARZIALMENTE_PAGATO') :
                                 getPaymentStatusBadge('COMPLETAMENTE_PAGATO');
                    
                    return (
                      <div 
                        key={group.tableNumber}
                        className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          backgroundColor: colors.bg.card,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                                {group.tableNumber === 'ASPORTO' ? 'Asporto' : 
                                 group.tableNumber === 'BANCONE' ? 'Bancone' : 
                                 `Tavolo ${group.tableNumber}`}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm" style={{ color: colors.text.muted }}>
                                  {group.totalOrders} ordin{group.totalOrders === 1 ? 'e' : 'i'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: badge.bgColor, color: badge.color }}>
                                  {badge.text}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold" style={{ color: colors.accent }}>
                                €{group.totalUnpaid.toFixed(2)}
                              </div>
                              {group.totalPaid > 0 && (
                                <div className="text-xs" style={{ color: colors.text.muted }}>
                                  Pagato: €{group.totalPaid.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Customer names preview */}
                          <div className="mb-3">
                            <div className="flex flex-wrap gap-1">
                              {[...new Set(group.orders.map(o => o.nomeCliente || o.cliente?.nome || 'Cliente'))]
                                .slice(0, 3)
                                .map((name, i) => (
                                  <span key={i} className="text-xs px-2 py-1 rounded-full" 
                                    style={{ backgroundColor: colors.bg.darker, color: colors.text.secondary }}>
                                    {name}
                                  </span>
                              ))}
                              {[...new Set(group.orders.map(o => o.nomeCliente || o.cliente?.nome))].length > 3 && (
                                <span className="text-xs px-2 py-1" style={{ color: colors.text.muted }}>
                                  +{[...new Set(group.orders.map(o => o.nomeCliente || o.cliente?.nome))].length - 3}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {group.totalUnpaid > 0 && (
                              <>
                                <button
                                  onClick={() => handleQuickPayTable(group)}
                                  className="flex-1 py-2 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                  <Euro className="h-4 w-4" />
                                  Paga Tutto
                                </button>
                                <button
                                  onClick={() => handleTableSelect(group)}
                                  className="flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                  style={{
                                    backgroundColor: colors.bg.darker,
                                    color: colors.text.secondary
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
                                >
                                  <ShoppingBag className="h-4 w-4" />
                                  Seleziona
                                </button>
                              </>
                            )}
                            {group.totalUnpaid === 0 && (
                              <div className="flex-1 py-2 px-3 rounded-lg text-center" 
                                style={{ backgroundColor: colors.text.success + '20', color: colors.text.success }}>
                                <CheckCircle className="h-4 w-4 inline mr-2" />
                                Completamente Pagato
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Step 2: Select Items */}
            {currentStep === 'select-items' && selectedTable && (
              <div className="space-y-4">
                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Select all unpaid items
                      const items: SelectedItem[] = [];
                      selectedTable.orders.forEach(order => {
                        order.righe.filter(r => !r.isPagato).forEach(riga => {
                          items.push({
                            orderId: order.id,
                            rigaId: riga.id,
                            productName: riga.prodotto.nome,
                            quantity: riga.quantita,
                            unitPrice: riga.prezzo,
                            totalPrice: riga.quantita * riga.prezzo
                          });
                        });
                      });
                      setSelectedItems(items);
                    }}
                    className="px-4 py-2 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: colors.accent,
                      color: colors.button.primaryText
                    }}
                  >
                    Seleziona Tutto
                  </button>
                  <button
                    onClick={() => setSelectedItems([])}
                    className="px-4 py-2 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: colors.bg.darker,
                      color: colors.text.secondary
                    }}
                  >
                    Deseleziona Tutto
                  </button>
                </div>

                {/* Orders and items */}
                {selectedTable.orders.map((order) => (
                  <div key={order.id} className="rounded-lg" style={{ 
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4" style={{ color: colors.text.secondary }} />
                          <span className="font-medium" style={{ color: colors.text.primary }}>
                            {order.nomeCliente || order.cliente?.nome || 'Cliente'}
                          </span>
                          <span className="text-sm" style={{ color: colors.text.muted }}>
                            {new Date(order.dataConsegna).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <span className="font-bold" style={{ color: colors.text.primary }}>
                          €{order.rimanente.toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {order.righe.map((riga) => {
                          const isSelected = selectedItems.some(item => 
                            item.orderId === order.id && item.rigaId === riga.id
                          );
                          
                          return (
                            <button
                              key={riga.id}
                              onClick={() => toggleItemSelection(order, riga)}
                              disabled={riga.isPagato}
                              className="w-full p-3 rounded-lg transition-all duration-200 text-left"
                              style={{
                                backgroundColor: isSelected ? colors.accent + '20' : 
                                               riga.isPagato ? colors.bg.darker + '60' : colors.bg.darker,
                                borderColor: isSelected ? colors.accent : 'transparent',
                                borderWidth: '2px',
                                borderStyle: 'solid',
                                opacity: riga.isPagato ? 0.6 : 1,
                                cursor: riga.isPagato ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors`}
                                    style={{ 
                                      borderColor: riga.isPagato ? colors.text.success : 
                                                  isSelected ? colors.accent : colors.border.primary,
                                      backgroundColor: riga.isPagato ? colors.text.success : 
                                                      isSelected ? colors.accent : 'transparent'
                                    }}>
                                    {(riga.isPagato || isSelected) && (
                                      <CheckCircle className="h-3 w-3 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-medium" style={{ 
                                      color: colors.text.primary,
                                      textDecoration: riga.isPagato ? 'line-through' : 'none'
                                    }}>
                                      {riga.quantita}x {riga.prodotto.nome}
                                    </span>
                                    {riga.isPagato && riga.pagatoDa && (
                                      <span className="ml-2 text-xs px-2 py-1 rounded-full"
                                        style={{ backgroundColor: colors.text.success + '20', color: colors.text.success }}>
                                        Pagato da {riga.pagatoDa}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="font-medium" style={{ color: colors.text.primary }}>
                                  €{(riga.quantita * riga.prezzo).toFixed(2)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Continue button */}
                {selectedItems.length > 0 && (
                  <div className="sticky bottom-4 mt-6">
                    <button
                      onClick={() => setCurrentStep('payment-details')}
                      className="w-full py-4 rounded-xl font-medium text-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3"
                      style={{
                        backgroundColor: colors.accent,
                        color: colors.button.primaryText
                      }}
                    >
                      <span>Procedi al Pagamento</span>
                      <span className="px-3 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        €{getTotalSelected().toFixed(2)}
                      </span>
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Payment Details & Request */}
            {currentStep === 'payment-details' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <PaymentMethodGrid
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  showQuickAmount
                  amount={getTotalSelected()}
                />

                {/* Customer name */}
                {paymentMethod && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{ color: colors.text.primary }}>
                      Nome Cliente
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          setShowSuggestions(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowSuggestions(customerName.length > 0)}
                        placeholder="Inserisci il nome del cliente"
                        className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: colors.bg.input,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          color: colors.text.primary
                        }}
                      />
                      
                      {/* Suggestions dropdown */}
                      {showSuggestions && customerSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto"
                          style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                          {customerSuggestions
                            .filter(name => name.toLowerCase().includes(customerName.toLowerCase()))
                            .slice(0, 5)
                            .map((name, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setCustomerName(name);
                                  setShowSuggestions(false);
                                }}
                                className="w-full px-4 py-2 text-left transition-colors"
                                style={{ color: colors.text.primary }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Send Request button */}
                {paymentMethod && customerName && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="rounded-lg p-4" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                      <h4 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>Riepilogo Richiesta</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Totale richiesto:</span>
                          <span className="font-bold text-lg" style={{ color: colors.accent }}>€{getTotalSelected().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Modalità:</span>
                          <span className="font-medium" style={{ color: colors.text.primary }}>{paymentMethod}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Cliente:</span>
                          <span className="font-medium" style={{ color: colors.text.primary }}>{customerName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Info message */}
                    <div className="p-4 rounded-lg flex items-start gap-3" 
                      style={{ backgroundColor: colors.accent + '20', color: colors.accent }}>
                      <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Come funziona</div>
                        <div className="text-sm opacity-90 mt-1">
                          1. La richiesta viene inviata alla cassa<br/>
                          2. Il cliente si reca in cassa per pagare<br/>
                          3. La cassa conferma o annulla il pagamento
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handlePaymentRequest}
                      disabled={isProcessingPayment}
                      className="w-full py-4 rounded-xl font-medium text-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3"
                      style={{
                        backgroundColor: colors.text.success,
                        color: 'white',
                        opacity: isProcessingPayment ? 0.5 : 1,
                        cursor: isProcessingPayment ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isProcessingPayment ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Invio in corso...
                        </>
                      ) : (
                        <>
                          <Receipt className="h-5 w-5" />
                          Invia Richiesta alla Cassa
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>

      {/* Payment History Modal */}
      <PaymentHistory 
        isOpen={showPaymentHistory}
        onClose={() => setShowPaymentHistory(false)}
      />
    </div>
  );
}