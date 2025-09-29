"use client";

import { Trophy, TrendingUp } from "lucide-react";
import { previewPunti } from "@/lib/actions/fidelity";

interface FidelityPointsPreviewProps {
  importo: number;
  className?: string;
}

export function FidelityPointsPreview({ importo, className = "" }: FidelityPointsPreviewProps) {
  const preview = previewPunti(importo);
  
  if (preview.puntiAttuali === 0 && !preview.prossimaSoglia) {
    return null;
  }

  return (
    <div className={`bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Punti Fidelity
          </span>
        </div>
        <div className="text-right">
          {preview.puntiAttuali > 0 ? (
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              +{preview.puntiAttuali} {preview.puntiAttuali === 1 ? 'punto' : 'punti'}
            </div>
          ) : (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              Nessun punto
            </div>
          )}
        </div>
      </div>
      
      {preview.prossimaSoglia && preview.differenzaImporto > 0 && preview.differenzaImporto <= 2 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <TrendingUp className="w-3 h-3" />
          <span>
            Spendi €{preview.differenzaImporto.toFixed(2)} in più per {preview.puntiProssimaSoglia} {preview.puntiProssimaSoglia === 1 ? 'punto' : 'punti'}
          </span>
        </div>
      )}
    </div>
  );
}