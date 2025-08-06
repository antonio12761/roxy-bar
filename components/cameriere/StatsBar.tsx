import React from 'react';
import { Users, ClipboardList, Square } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface StatsBarProps {
  occupiedTables: number;
  totalTables: number;
  ordersCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({ 
  occupiedTables, 
  totalTables, 
  ordersCount 
}) => {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md shadow-lg"
      style={{ 
        backgroundColor: colors.bg.dark + 'f2',
        borderTop: `1px solid ${colors.border.primary}`,
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="px-4 py-3">
        <div className="flex justify-center">
          <div className="flex items-center gap-6 text-sm">
            {/* Occupied Tables */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: colors.text.secondary }} />
              <span style={{ color: colors.text.secondary }}>{occupiedTables} Occupati</span>
            </div>
            
            {/* Orders Stats */}
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" style={{ color: colors.text.secondary }} />
              <span style={{ color: colors.text.secondary }}>{ordersCount} Ordini</span>
            </div>

            {/* Free Tables */}
            <div className="flex items-center gap-2">
              <Square className="w-4 h-4" style={{ color: colors.text.secondary }} />
              <span style={{ color: colors.text.secondary }}>{totalTables - occupiedTables} liberi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};