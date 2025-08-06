"use client";

import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface TabBookmark {
  id: string;
  title: string;
  icon: React.ElementType;
  isActive?: boolean;
  onClick?: () => void;
}

interface TabBookmarksProps {
  tabs: TabBookmark[];
  className?: string;
}

export function TabBookmarks({ tabs, className }: TabBookmarksProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  return (
    <div className={cn("relative", className)}>
      {/* Tab bookmarks container - attaccate senza gap */}
      <div className="flex mb-0">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = tab.isActive;
          
          return (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={cn(
                "relative group transition-all duration-300 ease-out",
                "flex items-center gap-2 px-4 py-3 text-sm font-medium",
                "border-t-2 border-r-2",
                index === 0 ? "border-l-2 rounded-tl-2xl" : "", // Solo il primo ha bordo sinistro
                index === tabs.length - 1 ? "rounded-tr-2xl" : "", // Solo l'ultimo ha bordo destro arrotondato
                "hover:scale-105",
                isActive 
                  ? "z-20" 
                  : "z-10 hover:z-15"
              )}
              style={{
                backgroundColor: isActive 
                  ? colors.bg.card 
                  : colors.bg.dark, // Tab non selezionate più scure
                // Use individual border properties instead of shorthand to avoid conflicts
                borderTopColor: isActive 
                  ? colors.border.primary 
                  : colors.border.secondary,
                borderRightColor: isActive 
                  ? colors.border.primary 
                  : colors.border.secondary,
                borderLeftColor: isActive 
                  ? colors.border.primary 
                  : colors.border.secondary,
                borderBottomColor: isActive ? 'transparent' : colors.border.secondary, // Elimina bordo inferiore per fusione
                color: isActive 
                  ? colors.text.primary 
                  : colors.text.secondary,
                marginBottom: isActive ? '-2px' : '0px', // Tab attiva si sovrappone leggermente per fusione
                transform: 'translateY(0px)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                  e.currentTarget.style.color = colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colors.bg.dark;
                  e.currentTarget.style.color = colors.text.secondary;
                }
              }}
            >
              {/* Tab content */}
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{tab.title}</span>
              
              {/* Active indicator - solo curva destra per connessione pulita */}
              {isActive && index === tabs.length - 1 && (
                <div 
                  className="absolute -bottom-2 -right-2 w-2 h-2"
                  style={{
                    backgroundColor: 'transparent',
                    borderBottomLeftRadius: '8px',
                    boxShadow: `-2px 2px 0 0 ${colors.bg.card}`
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TabContentCardProps {
  children: React.ReactNode;
  className?: string;
}

export function TabContentCard({ children, className }: TabContentCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  return (
    <div 
      className={cn(
        "border-2 rounded-2xl shadow-lg backdrop-blur-sm",
        "transition-all duration-300",
        className
      )}
      style={{
        backgroundColor: colors.bg.card,
        borderColor: colors.border.primary,
        // Remove top border radius where tabs connect
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '16px'
      }}
    >
      {children}
    </div>
  );
}