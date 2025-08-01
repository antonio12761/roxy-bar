"use client";

import { X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
}

export function ThemedModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = "md",
  showCloseButton = true,
  closeOnBackdropClick = true 
}: ThemedModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md sm:max-w-lg md:max-w-xl",
    lg: "max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl",
    xl: "max-w-full sm:max-w-4xl md:max-w-6xl lg:max-w-7xl"
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={closeOnBackdropClick ? onClose : undefined}
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.25rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)',
        paddingLeft: 'max(env(safe-area-inset-left), 0.25rem)',
        paddingRight: 'max(env(safe-area-inset-right), 0.25rem)'
      }}
    >
      <div 
        className={`rounded-lg w-full ${sizeClasses[size]} overflow-y-auto overflow-x-hidden`}
        style={{
          maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 0.5rem)',
          maxWidth: 'calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 0.5rem)',
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div 
            className="p-1 sm:p-3 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${colors.border.primary}` }}
          >
            {title && (
              <h2 className="text-base sm:text-lg font-bold" style={{ color: colors.text.primary }}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'transparent',
                  color: colors.text.muted
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Modal Content */}
        <div className="p-1 sm:p-3 md:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}