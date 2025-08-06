import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export const TableSkeletonLoader: React.FC = () => {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  return (
    <div className="space-y-0">
      {[1, 2, 3].map((groupIndex) => (
        <div 
          key={groupIndex}
          className={`p-6 border-2 border-l-2 border-r-2 animate-pulse ${
            groupIndex === 0 ? 'rounded-t-2xl border-t-2' : 'border-t-0'
          } ${
            groupIndex === 2 ? 'rounded-b-2xl border-b-2' : 'border-b-0'
          }`}
          style={{
            backgroundColor: 'transparent',
            borderColor: colors.border.secondary
          }}
        >
          {/* Group Header Skeleton */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: colors.bg.hover }}></div>
            <div className="h-5 w-32 rounded" style={{ backgroundColor: colors.bg.hover }}></div>
            <div className="h-4 w-8 rounded" style={{ backgroundColor: colors.bg.hover }}></div>
          </div>
          
          {/* Tables Grid Skeleton */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {[...Array(groupIndex === 0 ? 8 : groupIndex === 1 ? 6 : 4)].map((_, tableIndex) => (
              <div 
                key={tableIndex}
                className="aspect-square rounded-lg border-2 p-2"
                style={{
                  backgroundColor: colors.bg.hover,
                  borderColor: colors.border.secondary
                }}
              >
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <div className="w-8 h-5 rounded" style={{ backgroundColor: colors.bg.dark }}></div>
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: colors.bg.dark }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};