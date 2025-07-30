"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  Clock, 
  Coffee, 
  ChefHat, 
  CreditCard, 
  Package, 
  Plus, 
  Eye,
  AlertCircle
} from "lucide-react";

interface OrderItem {
  id: string;
  prodotto: { nome: string };
  quantita: number;
  prezzo: number;
  stato: string;
  postazione: string;
  isPagato: boolean;
  pagatoDa?: string;
}

interface Order {
  id: string;
  numero: number;
  stato: string;
  statoPagamento: string;
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  dataApertura: string;
  nomeCliente?: string;
}

interface TableInfo {
  numero: string;
  stato: 'LIBERO' | 'OCCUPATO';
  ordinazioni: Order[];
  totaleComplessivo: number;
  totalePagato: number;
  rimanente: number;
  clientiCount: number;
  preparaReady: number;
  cucinaReady: number;
  preparaWorking: number;
  cucinaWorking: number;
  oldestOrderTime: string;
  hasUrgentItems: boolean;
}

interface UnifiedTableDashboardProps {
  cameriereId: string;
}

export default function UnifiedTableDashboard({ cameriereId }: UnifiedTableDashboardProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Mock data - in un'app reale, questi dati verrebbero da API
  const loadTableData = async () => {
    setIsLoading(true);
    try {
      // Simula chiamata API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockTables: TableInfo[] = [
        {
          numero: '5',
          stato: 'OCCUPATO',
          ordinazioni: [
            {
              id: 'ord-1',
              numero: 123,
              stato: 'IN_PREPARAZIONE',
              statoPagamento: 'NON_PAGATO',
              righe: [
                {
                  id: 'riga-1',
                  prodotto: { nome: 'Caffè' },
                  quantita: 2,
                  prezzo: 2.50,
                  stato: 'PRONTO',
                  postazione: 'PREPARA',
                  isPagato: false
                },
                {
                  id: 'riga-2',
                  prodotto: { nome: 'Pasta al Pomodoro' },
                  quantita: 1,
                  prezzo: 12.00,
                  stato: 'IN_LAVORAZIONE',
                  postazione: 'CUCINA',
                  isPagato: false
                }
              ],
              totale: 17.00,
              totalePagato: 0,
              dataApertura: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
              nomeCliente: 'Mario Rossi'
            }
          ],
          totaleComplessivo: 17.00,
          totalePagato: 0,
          rimanente: 17.00,
          clientiCount: 1,
          preparaReady: 1,
          cucinaReady: 0,
          preparaWorking: 0,
          cucinaWorking: 1,
          oldestOrderTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          hasUrgentItems: false
        },
        {
          numero: '8',
          stato: 'OCCUPATO',
          ordinazioni: [
            {
              id: 'ord-2',
              numero: 124,
              stato: 'PRONTO',
              statoPagamento: 'PARZIALMENTE_PAGATO',
              righe: [
                {
                  id: 'riga-3',
                  prodotto: { nome: 'Birra' },
                  quantita: 2,
                  prezzo: 4.50,
                  stato: 'PRONTO',
                  postazione: 'PREPARA',
                  isPagato: true,
                  pagatoDa: 'Luigi'
                },
                {
                  id: 'riga-4',
                  prodotto: { nome: 'Pizza Margherita' },
                  quantita: 1,
                  prezzo: 8.00,
                  stato: 'PRONTO',
                  postazione: 'CUCINA',
                  isPagato: false
                }
              ],
              totale: 17.00,
              totalePagato: 9.00,
              dataApertura: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
              nomeCliente: 'Luigi Verdi'
            }
          ],
          totaleComplessivo: 17.00,
          totalePagato: 9.00,
          rimanente: 8.00,
          clientiCount: 1,
          preparaReady: 0,
          cucinaReady: 1,
          preparaWorking: 0,
          cucinaWorking: 0,
          oldestOrderTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          hasUrgentItems: false
        },
        {
          numero: '12',
          stato: 'LIBERO',
          ordinazioni: [],
          totaleComplessivo: 0,
          totalePagato: 0,
          rimanente: 0,
          clientiCount: 0,
          preparaReady: 0,
          cucinaReady: 0,
          preparaWorking: 0,
          cucinaWorking: 0,
          oldestOrderTime: '',
          hasUrgentItems: false
        }
      ];
      
      setTables(mockTables);
    } catch (error) {
      console.error('Errore caricamento tavoli:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTableData();
    const interval = setInterval(loadTableData, 30000); // Refresh ogni 30 secondi
    return () => clearInterval(interval);
  }, [cameriereId]);

  const getTableStatusColor = (table: TableInfo) => {
    if (table.stato === 'LIBERO') return 'border-gray-300 bg-gray-50';
    if (table.hasUrgentItems) return 'border-red-500 bg-red-50';
    if (table.preparaReady > 0 || table.cucinaReady > 0) return 'border-green-500 bg-green-50';
    if (table.preparaWorking > 0 || table.cucinaWorking > 0) return 'border-yellow-500 bg-yellow-50';
    return 'border-blue-500 bg-blue-50';
  };

  const getElapsedTime = (dateString: string) => {
    if (!dateString) return '';
    const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const TableCard = ({ table }: { table: TableInfo }) => (
    <div 
      className={`rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
        getTableStatusColor(table)
      } ${selectedTable?.numero === table.numero ? 'ring-2 ring-primary' : ''}`}
      onClick={() => setSelectedTable(selectedTable?.numero === table.numero ? null : table)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
            table.stato === 'LIBERO' ? 'bg-gray-400' :
            table.hasUrgentItems ? 'bg-red-500' :
            table.preparaReady > 0 || table.cucinaReady > 0 ? 'bg-green-500' :
            table.preparaWorking > 0 || table.cucinaWorking > 0 ? 'bg-yellow-500' :
            'bg-blue-500'
          }`}>
            {table.numero}
          </div>
          <div>
            <div className="font-medium">Tavolo {table.numero}</div>
            <div className="text-sm text-gray-500">
              {table.stato === 'LIBERO' ? 'Libero' : `${table.clientiCount} clienti`}
            </div>
          </div>
        </div>
        
        {table.stato !== 'LIBERO' && (
          <div className="text-right">
            <div className="font-semibold">€{table.rimanente.toFixed(2)}</div>
            {table.totalePagato > 0 && (
              <div className="text-sm text-green-600">Pagato: €{table.totalePagato.toFixed(2)}</div>
            )}
          </div>
        )}
      </div>

      {/* Status Indicators */}
      {table.stato !== 'LIBERO' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Prepara Status */}
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-gray-600" />
              <div className="flex items-center gap-1">
                {table.preparaReady > 0 && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    {table.preparaReady} pronti
                  </span>
                )}
                {table.preparaWorking > 0 && (
                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                    {table.preparaWorking} in prep.
                  </span>
                )}
              </div>
            </div>
            
            {/* Cucina Status */}
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-gray-600" />
              <div className="flex items-center gap-1">
                {table.cucinaReady > 0 && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    {table.cucinaReady} pronti
                  </span>
                )}
                {table.cucinaWorking > 0 && (
                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                    {table.cucinaWorking} in prep.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Timing */}
          {table.oldestOrderTime && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>Da {getElapsedTime(table.oldestOrderTime)}</span>
            </div>
          )}
        </>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 mt-3">
        {table.stato === 'LIBERO' && (
          <Link 
            href={`/cameriere/nuova-ordinazione?tavolo=${table.numero}`}
            className="flex-1 bg-primary text-white py-2 px-3 rounded text-sm text-center hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 inline mr-1" />
            Nuovo Ordine
          </Link>
        )}
        
        {table.stato === 'OCCUPATO' && (
          <>
            {(table.preparaReady > 0 || table.cucinaReady > 0) && (
              <button className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 transition-colors">
                <Package className="h-4 w-4 inline mr-1" />
                Ritira
              </button>
            )}
            
            {table.rimanente > 0 && (
              <Link
                href={`/cameriere/conti?tavolo=${table.numero}`}
                className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm text-center hover:bg-blue-700 transition-colors"
              >
                <CreditCard className="h-4 w-4 inline mr-1" />
                Conto
              </Link>
            )}
          </>
        )}
        
        <Link
          href={`/cameriere/tavolo/${table.numero}`}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
        >
          <Eye className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">I Miei Tavoli</h2>
          <p className="text-gray-600">
            {tables.filter(t => t.stato !== 'LIBERO').length} tavoli occupati • 
            {tables.filter(t => t.preparaReady > 0 || t.cucinaReady > 0).length} con prodotti pronti
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className={`grid gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
          : 'grid-cols-1'
      }`}>
        {tables.map(table => (
          <TableCard key={table.numero} table={table} />
        ))}
      </div>

      {/* Table Detail Panel */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold">Dettagli Tavolo {selectedTable.numero}</h3>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedTable.ordinazioni.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p>Tavolo libero</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTable.ordinazioni.map(order => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">Ordine #{order.numero}</div>
                          {order.nomeCliente && (
                            <div className="text-sm text-gray-500">{order.nomeCliente}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">€{order.totale.toFixed(2)}</div>
                          {order.totalePagato > 0 && (
                            <div className="text-sm text-green-600">
                              Pagato: €{order.totalePagato.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {order.righe.map(riga => (
                          <div key={riga.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span>{riga.quantita}x {riga.prodotto.nome}</span>
                              <span className={`w-2 h-2 rounded-full ${
                                riga.stato === 'PRONTO' ? 'bg-green-500' :
                                riga.stato === 'IN_LAVORAZIONE' ? 'bg-yellow-500' :
                                'bg-gray-300'
                              }`} />
                              {riga.isPagato && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  Pagato{riga.pagatoDa ? ` da ${riga.pagatoDa}` : ''}
                                </span>
                              )}
                            </div>
                            <span>€{(riga.prezzo * riga.quantita).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}