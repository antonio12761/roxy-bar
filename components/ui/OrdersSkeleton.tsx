"use client";

import { useTheme } from "@/contexts/ThemeContext";

export function OrdersSkeleton() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  return (
    <div className="space-y-4">
      {/* Skeleton cards */}
      {[1, 2, 3].map((index) => (
        <div
          key={index}
          className="rounded-lg overflow-hidden animate-pulse"
          style={{
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          {/* Header */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Table number */}
                <div 
                  className="h-7 w-24 rounded"
                  style={{ backgroundColor: colors.bg.hover }}
                />
                {/* Zone */}
                <div 
                  className="h-5 w-16 rounded"
                  style={{ backgroundColor: colors.bg.hover }}
                />
                {/* Customer name */}
                <div 
                  className="h-5 w-32 rounded"
                  style={{ backgroundColor: colors.bg.hover }}
                />
              </div>
              <div className="flex items-center gap-3">
                {/* Time */}
                <div 
                  className="h-5 w-20 rounded"
                  style={{ backgroundColor: colors.bg.hover }}
                />
                {/* Chevron */}
                <div 
                  className="h-5 w-5 rounded"
                  style={{ backgroundColor: colors.bg.hover }}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div 
            className="p-4 space-y-2"
            style={{ 
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderTopColor: colors.border.secondary
            }}
          >
            {[1, 2].map((item) => (
              <div 
                key={item}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.bg.hover }}
              >
                <div className="flex-1 space-y-2">
                  {/* Product name */}
                  <div 
                    className="h-5 w-48 rounded"
                    style={{ backgroundColor: colors.bg.darker }}
                  />
                  {/* Status */}
                  <div 
                    className="h-4 w-24 rounded"
                    style={{ backgroundColor: colors.bg.darker }}
                  />
                </div>
                {/* Button */}
                <div 
                  className="h-9 w-20 rounded-lg"
                  style={{ backgroundColor: colors.bg.darker }}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div 
            className="p-4 flex items-center justify-between"
            style={{ 
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderTopColor: colors.border.secondary,
              backgroundColor: colors.bg.hover
            }}
          >
            <div 
              className="h-5 w-16 rounded"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div 
              className="h-6 w-20 rounded"
              style={{ backgroundColor: colors.bg.darker }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}