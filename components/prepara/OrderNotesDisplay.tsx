'use client';

import React, { useState, useEffect } from 'react';
import { Clock, User, ChevronRight, Users, Loader2 } from 'lucide-react';
import SingleOrderDetailModal from './SingleOrderDetailModal';
import { getMergedOrdersHistory } from '@/lib/actions/ordinazioni';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderMergeDetail {
  id: string;
  tipo: 'originale' | 'aggiunto';
  numero?: number;
  cliente: string;
  cameriere: string;
  timestamp: string;
  items: Array<{
    id: string;
    prodotto: string;
    quantita: number;
    prezzo: number;
    note?: string;
  }>;
  totale: number;
}

interface OrderNotesDisplayProps {
  note: string;
  orderId: string;
  colors: any;
}

export default function OrderNotesDisplay({ note, orderId, colors }: OrderNotesDisplayProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderMergeDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [mergeHistory, setMergeHistory] = useState<OrderMergeDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMerge, setHasMerge] = useState(false);
  
  // Carica lo storico merge all'avvio
  useEffect(() => {
    loadMergeHistory();
  }, [orderId]);
  
  const loadMergeHistory = async () => {
    try {
      setIsLoading(true);
      const result = await getMergedOrdersHistory(orderId);
      
      if (result.success && result.mergeHistory) {
        setMergeHistory(result.mergeHistory as OrderMergeDetail[]);
        setHasMerge(result.hasMerge || false);
      } else {
        // Se non ci sono dati, usa il parsing delle note come fallback
        parseNotesForMerge();
      }
    } catch (error) {
      console.error('Errore caricamento storico merge:', error);
      // Fallback al parsing delle note
      parseNotesForMerge();
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fallback: parsing delle note per identificare merge
  const parseNotesForMerge = () => {
    if (!note) {
      setHasMerge(false);
      return;
    }
    
    // Controlla se ci sono indicazioni di merge nelle note
    const hasMergeIndicator = note.includes('Aggiunto ordine da');
    setHasMerge(hasMergeIndicator);
    
    // Se c'è merge ma non abbiamo dati dal server, crea dati di base
    if (hasMergeIndicator) {
      const basicHistory: OrderMergeDetail[] = [];
      
      // Estrai info cliente
      const clienteMatch = note.match(/Cliente:\s*([^-|]+)/);
      const cliente = clienteMatch ? clienteMatch[1].trim() : 'Cliente';
      
      // Ordine originale (placeholder)
      basicHistory.push({
        id: `${orderId}-original`,
        tipo: 'originale' as const,
        cliente,
        cameriere: 'Cameriere',
        timestamp: new Date().toISOString(),
        items: [],
        totale: 0
      });
      
      // Estrai ordini aggiunti
      const mergePattern = /Aggiunto ordine da\s+([^a\s][^a]*?)\s+alle\s+(\d{2}:\d{2}:\d{2})/g;
      let match;
      let mergeIndex = 1;
      
      while ((match = mergePattern.exec(note)) !== null) {
        basicHistory.push({
          id: `${orderId}-merge-${mergeIndex}`,
          tipo: 'aggiunto' as const,
          numero: mergeIndex,
          cliente,
          cameriere: match[1].trim(),
          timestamp: match[2],
          items: [],
          totale: 0
        });
        mergeIndex++;
      }
      
      if (basicHistory.length > 1) {
        setMergeHistory(basicHistory);
      }
    }
  };
  
  // Handler per il click su un ordine
  const handleOrderClick = async (ordine: OrderMergeDetail) => {
    console.log('[OrderNotes] Click su ordine:', ordine);
    console.log('[OrderNotes] Tipo ordine:', ordine.tipo);
    console.log('[OrderNotes] Items presenti:', ordine.items?.length || 0);
    
    // Solo gli ordini merged sono cliccabili
    if (ordine.tipo === 'originale') {
      console.log('[OrderNotes] Ordine originale, skip');
      return;
    }
    
    // Mostra sempre il modal per ordini aggiunti, anche senza items (per debug)
    console.log('[OrderNotes] Apertura modal per ordine:', ordine.id);
    setSelectedOrder(ordine);
    setShowDetailModal(true);
  };
  
  // Estrai informazioni base dalle note per mostrare sempre cliente/posti
  const extractBasicInfo = () => {
    const info: { cliente?: string; posti?: number; hasOtherNotes?: boolean } = {};
    
    if (note) {
      const clienteMatch = note.match(/Cliente:\s*([^-|]+)/);
      if (clienteMatch) {
        info.cliente = clienteMatch[1].trim();
      }
      
      const postiMatch = note.match(/Posti:\s*(\d+)/);
      if (postiMatch) {
        info.posti = parseInt(postiMatch[1]);
      }
      
      // Controlla se ci sono altre note oltre a cliente/posti/merge
      const cleanedNote = note
        .replace(/Cliente:\s*[^-|]+/g, '')
        .replace(/Posti:\s*\d+/g, '')
        .replace(/Aggiunto ordine da\s+[^a\s][^a]*?\s+alle\s+\d{2}:\d{2}:\d{2}/g, '')
        .replace(/[\s|,-]+/g, '')
        .trim();
      
      info.hasOtherNotes = cleanedNote.length > 0;
    }
    
    return info;
  };
  
  const basicInfo = extractBasicInfo();
  
  // Se sta caricando, mostra skeleton
  if (isLoading) {
    return (
      <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: colors.bg.hover }}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.text.muted }} />
          <span className="text-sm" style={{ color: colors.text.muted }}>
            Caricamento dettagli ordine...
          </span>
        </div>
      </div>
    );
  }
  
  // Se non c'è merge E non ci sono note significative, non mostrare nulla
  if (!hasMerge && !basicInfo.cliente && !basicInfo.hasOtherNotes && !note) {
    return null;
  }
  
  // Se non c'è merge ma ci sono note, mostra solo le info base
  if (!hasMerge) {
    // Se non ci sono informazioni da mostrare, return null
    if (!basicInfo.cliente && !basicInfo.hasOtherNotes) {
      return null;
    }
    
    return (
      <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: colors.bg.hover }}>
        {basicInfo.cliente ? (
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
              Dettagli Ordine
            </p>
            <div className="flex items-center gap-3">
              {/* Badge Cliente */}
              <div 
                className="px-3 py-1.5 rounded-full flex items-center gap-2"
                style={{ 
                  backgroundColor: colors.button.primary + '20',
                  color: colors.button.primary
                }}
              >
                <User className="h-4 w-4" />
                <span className="font-medium text-sm">{basicInfo.cliente}</span>
              </div>
              
              {basicInfo.posti && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.text.muted }}>
                  <Users className="h-4 w-4" />
                  <span>{basicInfo.posti} {basicInfo.posti === 1 ? 'posto' : 'posti'}</span>
                </div>
              )}
            </div>
          </div>
        ) : basicInfo.hasOtherNotes ? (
          <>
            <p className="text-sm font-medium mb-1" style={{ color: colors.text.primary }}>Note ordine:</p>
            <p className="text-sm" style={{ color: colors.text.secondary }}>{note}</p>
          </>
        ) : null}
      </div>
    );
  }
  
  // Se c'è merge, mostra la tabella responsive e compatta
  return (
    <>
      <div className="rounded-lg mb-4 overflow-hidden" style={{ backgroundColor: colors.bg.hover }}>
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
              Storico Ordini Uniti
            </p>
            {basicInfo.posti && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm" style={{ color: colors.text.muted }}>
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{basicInfo.posti} {basicInfo.posti === 1 ? 'posto' : 'posti'}</span>
              </div>
            )}
          </div>
          
          {/* Versione Mobile - Cards compatte */}
          <div className="block sm:hidden space-y-2">
            {mergeHistory.map((ordine, index) => {
              const isClickable = ordine.tipo === 'aggiunto'; // Rimuovo check items per debug
              
              return (
                <div 
                  key={ordine.id}
                  className={`rounded-lg border p-3 ${
                    isClickable ? 'cursor-pointer active:scale-[0.98] transition-transform' : 'opacity-75'
                  }`}
                  style={{ 
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.primary
                  }}
                  onClick={() => {
                    console.log('[Click] Card/Row, isClickable:', isClickable);
                    if (isClickable) handleOrderClick(ordine);
                  }}
                >
                  {/* Prima riga: Tipo ordine e orario */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: colors.text.muted }}>
                      {ordine.tipo === 'originale' ? 'Originale' : `Aggiunto #${ordine.numero || index}`}
                    </span>
                    <div className="flex items-center gap-1 text-xs" style={{ color: colors.text.muted }}>
                      <Clock className="h-3 w-3" />
                      <span>
                        {ordine.timestamp.includes('T') 
                          ? new Date(ordine.timestamp).toLocaleTimeString('it-IT', { 
                              hour: '2-digit', 
                              minute: '2-digit'
                            })
                          : ordine.timestamp.substring(0, 5)
                        }
                      </span>
                    </div>
                  </div>
                  
                  {/* Seconda riga: Badge cliente e cameriere */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div 
                      className="inline-flex px-2 py-0.5 rounded items-center gap-1 text-xs font-medium"
                      style={{ 
                        backgroundColor: '#3B82F6' + '20',
                        color: '#3B82F6'
                      }}
                    >
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">{ordine.cliente}</span>
                    </div>
                    
                    <div 
                      className="inline-flex px-2 py-0.5 rounded items-center gap-1 text-xs font-medium"
                      style={{ 
                        backgroundColor: '#F59E0B' + '20',
                        color: '#F59E0B'
                      }}
                    >
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">{ordine.cameriere}</span>
                    </div>
                    
                    {isClickable && (
                      <ChevronRight className="h-4 w-4 ml-auto" style={{ color: colors.text.muted }} />
                    )}
                  </div>
                  
                  {/* Totale se disponibile */}
                  {ordine.totale > 0 && (
                    <div className="mt-2 text-xs font-medium text-right" style={{ color: colors.text.primary }}>
                      Totale: €{ordine.totale.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Versione Desktop - Tabella compatta */}
          <div className="hidden sm:block rounded-md border" style={{ borderColor: colors.border.primary }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: colors.border.primary }}>
                  <TableHead className="w-[100px] py-2 text-xs" style={{ color: colors.text.muted }}>
                    Ordine
                  </TableHead>
                  <TableHead className="py-2 text-xs" style={{ color: colors.text.muted }}>
                    Cliente
                  </TableHead>
                  <TableHead className="py-2 text-xs" style={{ color: colors.text.muted }}>
                    Cameriere
                  </TableHead>
                  <TableHead className="text-right py-2 text-xs" style={{ color: colors.text.muted }}>
                    Orario
                  </TableHead>
                  {mergeHistory.some(o => o.totale > 0) && (
                    <TableHead className="text-right py-2 text-xs" style={{ color: colors.text.muted }}>
                      Totale
                    </TableHead>
                  )}
                  <TableHead className="w-[30px] py-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergeHistory.map((ordine, index) => {
                  const isClickable = ordine.tipo === 'aggiunto'; // Rimuovo check items per debug
                  
                  return (
                    <TableRow 
                      key={ordine.id}
                      className={`${isClickable ? 'cursor-pointer hover:bg-muted/50' : 'opacity-75'}`}
                      style={{ borderColor: colors.border.primary }}
                      onClick={() => {
                    console.log('[Click] Card/Row, isClickable:', isClickable);
                    if (isClickable) handleOrderClick(ordine);
                  }}
                    >
                      <TableCell className="py-2 text-xs font-medium" style={{ color: colors.text.muted }}>
                        {ordine.tipo === 'originale' ? 'Originale' : `Aggiunto #${ordine.numero || index}`}
                      </TableCell>
                      <TableCell className="py-2">
                        <div 
                          className="inline-flex px-2 py-0.5 rounded items-center gap-1 text-xs font-medium"
                          style={{ 
                            backgroundColor: '#3B82F6' + '20',
                            color: '#3B82F6'
                          }}
                        >
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{ordine.cliente}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div 
                          className="inline-flex px-2 py-0.5 rounded items-center gap-1 text-xs font-medium"
                          style={{ 
                            backgroundColor: '#F59E0B' + '20',
                            color: '#F59E0B'
                          }}
                        >
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{ordine.cameriere}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1 text-xs" style={{ color: colors.text.muted }}>
                          <Clock className="h-3 w-3" />
                          <span>
                            {ordine.timestamp.includes('T') 
                              ? new Date(ordine.timestamp).toLocaleTimeString('it-IT', { 
                                  hour: '2-digit', 
                                  minute: '2-digit'
                                })
                              : ordine.timestamp.substring(0, 5)
                            }
                          </span>
                        </div>
                      </TableCell>
                      {mergeHistory.some(o => o.totale > 0) && (
                        <TableCell className="text-right py-2 text-xs font-medium" style={{ color: colors.text.primary }}>
                          {ordine.totale > 0 ? `€${ordine.totale.toFixed(2)}` : '-'}
                        </TableCell>
                      )}
                      <TableCell className="py-2">
                        {isClickable && (
                          <ChevronRight className="h-3 w-3 ml-auto" style={{ color: colors.text.muted }} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {mergeHistory.some(o => o.tipo === 'aggiunto' && o.items && o.items.length > 0) && (
            <p className="text-xs mt-2 italic" style={{ color: colors.text.muted }}>
              Tocca un ordine aggiunto per vedere i prodotti
            </p>
          )}
        </div>
      </div>
      
      {/* Modal dettagli ordine singolo */}
      <SingleOrderDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedOrder(null);
        }}
        orderDetail={selectedOrder}
      />
    </>
  );
}