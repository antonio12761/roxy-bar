"use client";

import React from "react";
import { TransizioneStatoError } from "@/lib/middleware/state-validation";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";

interface StateTransitionErrorProps {
  error: TransizioneStatoError | Error;
  reset?: () => void;
  transizioniPermesse?: string[];
}

export function StateTransitionError({ 
  error, 
  reset,
  transizioniPermesse 
}: StateTransitionErrorProps) {
  const isTransitionError = error instanceof TransizioneStatoError || error.name === 'TransizioneStatoError';
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg mx-auto">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Errore di Transizione Stato
          </h3>
          
          <p className="text-red-700 mb-4">
            {error.message}
          </p>
          
          {isTransitionError && transizioniPermesse && transizioniPermesse.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Transizioni consentite:
              </p>
              <div className="flex flex-wrap gap-2">
                {transizioniPermesse.map((stato) => (
                  <span
                    key={stato}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    <ArrowRight className="h-3 w-3" />
                    {stato}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {reset && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Riprova
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook per gestire gli errori di transizione
export function useStateTransitionError() {
  const [error, setError] = React.useState<TransizioneStatoError | null>(null);
  
  const handleTransitionError = React.useCallback((error: any) => {
    if (error.name === 'TransizioneStatoError') {
      setError(error);
      return true;
    }
    return false;
  }, []);
  
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);
  
  return {
    error,
    handleTransitionError,
    clearError,
    StateTransitionErrorComponent: error ? (
      <StateTransitionError 
        error={error} 
        reset={clearError}
      />
    ) : null
  };
}