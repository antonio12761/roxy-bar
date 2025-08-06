import React, { memo } from 'react';
import { User } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";

interface DebtCardProps {
  debito: {
    id: string;
    clienteNome: string;
    numeroOrdine?: number | null;
    importo: number;
    importoPagato: number;
    rimanente: number;
    dataCreazione: string;
    note?: string | null;
  };
  onClick: () => void;
}

const DebtCard = memo(function DebtCard({ debito, onClick }: DebtCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  return (
    <div
      onClick={onClick}
      className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105"
      style={{ 
        backgroundColor: colors.bg.card, 
        borderColor: colors.text.warning || colors.text.accent, 
        borderWidth: '1px', 
        borderStyle: 'solid' 
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5" style={{ color: colors.text.warning || colors.text.accent }} />
          <span className="font-medium" style={{ color: colors.text.primary }}>{debito.clienteNome}</span>
        </div>
        {debito.numeroOrdine ? (
          <span className="text-sm" style={{ color: colors.text.secondary }}>
            Ordine #{debito.numeroOrdine}
          </span>
        ) : (
          <span className="text-sm font-medium" style={{ color: colors.text.accent }}>
            Debito diretto
          </span>
        )}
      </div>
      
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-sm">
          <span style={{ color: colors.text.secondary }}>Importo totale</span>
          <span style={{ color: colors.text.primary }}>€{debito.importo.toFixed(2)}</span>
        </div>
        {debito.importoPagato > 0 && (
          <div className="flex justify-between text-sm">
            <span style={{ color: colors.text.secondary }}>Già pagato</span>
            <span style={{ color: colors.text.success }}>€{debito.importoPagato.toFixed(2)}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: colors.text.secondary }}>
          {new Date(debito.dataCreazione).toLocaleDateString('it-IT')}
        </span>
        <div className="text-lg font-semibold" style={{ color: colors.text.warning || colors.text.accent }}>
          €{debito.rimanente.toFixed(2)}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison per evitare re-render inutili
  return (
    prevProps.debito.id === nextProps.debito.id &&
    prevProps.debito.importo === nextProps.debito.importo &&
    prevProps.debito.importoPagato === nextProps.debito.importoPagato &&
    prevProps.debito.rimanente === nextProps.debito.rimanente &&
    prevProps.debito.dataCreazione === nextProps.debito.dataCreazione
  );
});

export default DebtCard;