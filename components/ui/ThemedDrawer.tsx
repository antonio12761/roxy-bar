"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface ThemedDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  headerContent: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
}

export function ThemedDrawer({ 
  isOpen, 
  onToggle, 
  headerContent, 
  children,
  maxHeight = "max-h-96"
}: ThemedDrawerProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 flex flex-col transition-all duration-300 safe-bottom ${
        isOpen ? maxHeight : 'max-h-24'
      }`}
      style={{
        backgroundColor: colors.bg.card,
        borderTop: `1px solid ${colors.border.primary}`,
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      {/* Drawer Header - Always visible */}
      <div 
        className="p-4 cursor-pointer"
        style={{ backgroundColor: colors.bg.darker }}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          {headerContent}
          <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 16 16" 
              fill="currentColor" 
              style={{ color: colors.text.muted }}
            >
              <path d="M4 6l4 4 4-4z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Drawer Content - Only visible when expanded */}
      {isOpen && (
        <div 
          className="flex-1 overflow-y-auto"
          style={{ borderTop: `1px solid ${colors.border.secondary}` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}