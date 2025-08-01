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
  History
} from "lucide-react";
import Link from "next/link";

interface Table {
  id: number;
  numero: string;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
  posti: number;
  zona?: string | null;
  clienteNome?: string | null;
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
}

export function TableOperationsModal({ isOpen, onClose, table }: TableOperationsModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [ordersCount, setOrdersCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);

  // Mock data - in un'app reale questi verrebbero da API
  useEffect(() => {
    if (table && table.stato === "OCCUPATO") {
      setOrdersCount(2);
      setPendingAmount(17.50);
    } else {
      setOrdersCount(0);
      setPendingAmount(0);
    }
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
      description: pendingAmount > 0 ? `Rimanente: €${pendingAmount.toFixed(2)}` : "Nessun importo da pagare",
      icon: CreditCard,
      color: "bg-green-500",
      href: `/cameriere/conti?tavolo=${table.numero}`,
      available: table.stato === "OCCUPATO" && pendingAmount > 0
    },
    {
      id: "current-orders",
      title: "Ordini in Corso",
      description: ordersCount > 0 ? `${ordersCount} ordini attivi` : "Nessun ordine attivo",
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