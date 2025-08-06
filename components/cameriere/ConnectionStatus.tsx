import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface ConnectionHealth {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  latency: number;
  lastHeartbeat: Date | null;
}

interface ConnectionStatusProps {
  connectionHealth: ConnectionHealth;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connectionHealth }) => {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1 rounded-lg"
      style={{ backgroundColor: colors.bg.card }}
    >
      <div 
        className={`w-2 h-2 rounded-full ${
          connectionHealth.status === 'connected' ? 'animate-pulse' : ''
        }`}
        style={{
          backgroundColor: connectionHealth.status === 'connected' ? colors.button.success :
                         connectionHealth.status === 'connecting' ? colors.accent : colors.text.error
        }}
      />
      <span className="text-sm" style={{ color: colors.text.secondary }}>
        {connectionHealth.status === 'connected' ? `${connectionHealth.latency}ms` : 
         connectionHealth.status === 'connecting' ? 'Connessione...' : 'Offline'}
      </span>
    </div>
  );
};