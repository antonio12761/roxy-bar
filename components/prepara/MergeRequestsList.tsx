'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface MergeRequestsListProps {
  mergeRequests: any[];
  isLoadingMergeRequests: boolean;
  onAcceptMerge: (richiestaId: string) => Promise<void>;
  onRejectMerge: (richiestaId: string) => Promise<void>;
  processingMergeRequest: string | null;
  colors: any;
}

export default function MergeRequestsList({
  mergeRequests,
  isLoadingMergeRequests,
  onAcceptMerge,
  onRejectMerge,
  processingMergeRequest,
  colors
}: MergeRequestsListProps) {
  if (mergeRequests.length === 0 && !isLoadingMergeRequests) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
        Richieste di aggiunta prodotti ({mergeRequests.length})
      </h3>
      
      {isLoadingMergeRequests ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 rounded-lg border animate-pulse"
              style={{
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-4 rounded w-32" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-3 rounded w-16" style={{ backgroundColor: colors.bg.hover }}></div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-3 rounded w-48" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-3 rounded w-40" style={{ backgroundColor: colors.bg.hover }}></div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: colors.bg.hover }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        mergeRequests.map((request) => (
          <div
            key={request.id}
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  Richiesto da: {request.richiedenteName}
                </p>
              </div>
              <span className="text-xs" style={{ color: colors.text.muted }}>
                {new Date(request.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div className="space-y-1 mb-3">
              <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Prodotti da aggiungere:
              </p>
              {request.prodotti.map((p: any, idx: number) => (
                <div key={idx} className="text-sm" style={{ color: colors.text.primary }}>
                  • {p.quantita}x {p.nome}
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => onAcceptMerge(request.id)}
                disabled={processingMergeRequest === request.id}
                className="flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                style={{
                  backgroundColor: colors.button.success,
                  color: colors.button.successText,
                  opacity: processingMergeRequest === request.id ? 0.6 : 1
                }}
              >
                {processingMergeRequest === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  'Aggiungi all\'ordine'
                )}
              </button>
              <button
                onClick={() => onRejectMerge(request.id)}
                disabled={processingMergeRequest === request.id}
                className="flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                style={{
                  backgroundColor: colors.text.error,
                  color: 'white',
                  opacity: processingMergeRequest === request.id ? 0.6 : 1
                }}
              >
                Rifiuta
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}