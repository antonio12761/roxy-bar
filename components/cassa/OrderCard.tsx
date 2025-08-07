import React from 'react';
import { User, Clock } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
  pagatoDa?: string;
  configurazione?: any; // Per miscelati
}

interface Payment {
  importo: number;
  modalita: string;
  clienteNome: string | null;
  timestamp: Date | string;
  righeIds?: any; // Info su quali righe sono state pagate
}

interface Order {
  id: string;
  numero: number;
  cameriere: {
    nome: string;
  };
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
  nomeCliente?: string | null;
  dataApertura: string;
  pagamenti?: Payment[];
}

interface OrderCardProps {
  order: Order;
  isSelected: boolean;
  onClick: () => void;
  isSelectable: boolean;
}

export default function OrderCard({ order, isSelected, onClick, isSelectable }: OrderCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const getOrderTime = (date: string) => {
    return new Date(date).toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Raggruppa le righe per prodotto e configurazione
  const groupedItems = order.righe.reduce((acc, item) => {
    // Per miscelati, crea una chiave unica che include la configurazione
    const configKey = item.configurazione?.selezioni 
      ? JSON.stringify(item.configurazione.selezioni)
      : '';
    const key = item.prodotto.nome + configKey;
    
    if (!acc[key]) {
      acc[key] = {
        nome: item.prodotto.nome,
        prezzo: item.prezzo,
        configurazione: item.configurazione,
        items: []
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { nome: string; prezzo: number; configurazione?: any; items: OrderItem[] }>);

  return (
    <div
      onClick={isSelectable ? onClick : undefined}
      className={`rounded-lg p-4 transition-all duration-200 ${
        isSelectable
          ? `cursor-pointer hover:scale-105 ${isSelected ? 'ring-2' : ''}`
          : 'opacity-75'
      }`}
      style={{ 
        backgroundColor: colors.bg.darker,
        borderColor: isSelected ? colors.border.primary : colors.border.secondary,
        borderWidth: isSelected ? '2px' : '1px',
        borderStyle: 'solid'
      }}
    >
      <span className="text-xs uppercase tracking-wider block mb-1" style={{ color: colors.text.muted }}>
        CARD ORDINE
      </span>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" style={{ color: colors.text.secondary }} />
          <span className="font-medium" style={{ color: colors.text.primary }}>
            Ordine #{order.numero}
          </span>
          {order.nomeCliente && (
            <span className="text-sm" style={{ color: colors.text.secondary }}>
              - {order.nomeCliente}
            </span>
          )}
        </div>
        <span className="text-sm" style={{ color: colors.text.secondary }}>
          {getOrderTime(order.dataApertura)}
        </span>
      </div>
      
      <div className="space-y-2 mb-3">
        {Object.values(groupedItems).slice(0, 4).map((group) => {
          // USA I DATI REALI DAL DATABASE invece di indovinare
          // Separa items pagati e non pagati basandosi su isPagato
          const itemsPagati = group.items.filter(item => item.isPagato === true);
          const itemsNonPagati = group.items.filter(item => item.isPagato !== true);
          
          // Debug minimale
          if (order.totalePagato > 0 && (itemsPagati.length > 0 || itemsNonPagati.length > 0)) {
            console.log(`Ordine #${order.numero} - ${group.nome}: ${itemsPagati.length} pagati, ${itemsNonPagati.length} da pagare`);
          }
          
          const quantitaPagata = itemsPagati.reduce((sum, item) => sum + item.quantita, 0);
          const quantitaNonPagata = itemsNonPagati.reduce((sum, item) => sum + item.quantita, 0);
          const prezzoUnitario = group.prezzo;
          
          // Ottieni info sul pagamento dal primo item pagato
          const primoItemPagato = itemsPagati[0];
          const pagatoDa = primoItemPagato?.pagatoDa || null;
          
          return (
            <div key={group.nome} className="space-y-1">
              {/* Mostra prima gli items non pagati se ce ne sono */}
              {quantitaNonPagata > 0 && (
                <div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: colors.text.primary }}>
                      {quantitaNonPagata}x {group.nome}
                    </span>
                    <span style={{ color: colors.text.primary }}>
                      €{(prezzoUnitario * quantitaNonPagata).toFixed(2)}
                    </span>
                  </div>
                  {/* Mostra ingredienti per miscelati */}
                  {group.configurazione?.selezioni && (
                    <div className="ml-4 mt-1 text-xs" style={{ color: colors.text.muted }}>
                      {group.configurazione.selezioni.map((sel: any, idx: number) => (
                        <span key={idx}>
                          {idx > 0 && ' • '}
                          {sel.bottiglie.map((b: any) => b.nome).join(', ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Mostra gli items pagati con dati REALI dal database */}
              {quantitaPagata > 0 && (
                <div className="flex items-center justify-between text-sm pl-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span style={{ 
                      color: colors.text.muted, 
                      textDecoration: 'line-through'
                    }}>
                      {quantitaPagata}x {group.nome}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium" 
                      style={{ 
                        backgroundColor: colors.button.success + '20', 
                        color: colors.button.success
                      }}
                    >
                      PAGATO
                    </span>
                    {/* Mostra chi ha pagato e quando */}
                    <span className="text-xs truncate" style={{ color: colors.text.secondary }}>
                      {pagatoDa || 'Cliente'}
                      {order.pagamenti && order.pagamenti.length > 0 && (
                        <>
                          {' • '}
                          {new Date(order.pagamenti[0].timestamp).toLocaleTimeString('it-IT', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                          {' • '}
                          {order.cameriere.nome}
                        </>
                      )}
                    </span>
                  </div>
                  <span style={{ 
                    color: colors.text.muted, 
                    textDecoration: 'line-through',
                    minWidth: 'fit-content'
                  }}>
                    €{(prezzoUnitario * quantitaPagata).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(groupedItems).length > 4 && (
          <div className="text-xs text-center" style={{ color: colors.text.muted }}>
            ... e altri {Object.keys(groupedItems).length - 4} prodotti
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: colors.text.secondary }}>
          {order.righe.length} articoli • {order.cameriere.nome}
        </div>
        <div className="text-lg font-semibold" style={{ 
          color: order.rimanente === 0 ? colors.text.success : colors.text.primary 
        }}>
          {order.rimanente === 0 && '✓ '}€{order.rimanente.toFixed(2)}
        </div>
      </div>
      
      {order.totalePagato > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-sm" style={{ color: colors.text.success }}>
            {order.rimanente === 0 
              ? `Completamente pagato: €${order.totalePagato.toFixed(2)}`
              : `Pagato parzialmente: €${order.totalePagato.toFixed(2)}`
            }
          </div>
          {order.pagamenti && order.pagamenti.length > 0 && (
            <div className="space-y-1">
              {order.pagamenti.map((payment, index) => {
                const paymentTime = new Date(payment.timestamp);
                const timeString = paymentTime.toLocaleTimeString('it-IT', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                // Prova a capire cosa è stato pagato con questo pagamento
                let descrizione = '';
                const importo = payment.importo;
                
                // Controlla ogni prodotto per vedere se corrisponde
                for (const gruppo of Object.values(groupedItems)) {
                  const prezzo = gruppo.items[0].prezzo;
                  const quantitaPossibile = Math.round(importo / prezzo);
                  if (Math.abs(quantitaPossibile * prezzo - importo) < 0.01) {
                    descrizione = `${quantitaPossibile}x ${gruppo.nome}`;
                    break;
                  }
                }
                
                return (
                  <div key={index} className="flex items-center justify-between text-xs p-1 rounded"
                    style={{ 
                      backgroundColor: colors.bg.hover,
                      color: colors.text.secondary 
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{timeString}</span>
                      {payment.clienteNome && (
                        <>
                          <span>•</span>
                          <span className="font-medium">{payment.clienteNome}</span>
                        </>
                      )}
                      {descrizione && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 text-xs rounded" 
                            style={{ 
                              backgroundColor: colors.button.success + '20',
                              color: colors.button.success
                            }}
                          >
                            {descrizione}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-medium">€{payment.importo.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}