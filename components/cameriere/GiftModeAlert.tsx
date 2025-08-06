import React from 'react';

interface GiftModeAlertProps {
  isActive: boolean;
}

export const GiftModeAlert: React.FC<GiftModeAlertProps> = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-400/40 text-yellow-200 rounded-xl text-center font-medium shadow-lg backdrop-blur-sm animate-pulse">
      🎁 Modalità Regalo Attiva - Seleziona un tavolo per il destinatario
    </div>
  );
};