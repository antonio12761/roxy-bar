"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Palette } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className = "" }: ThemeSelectorProps) {
  const { currentTheme, themeMode, setTheme, availableThemes } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedMode = themeMode === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode];

  // Ensure component is mounted before using portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply blur effect when modal is open
  useEffect(() => {
    if (showThemeMenu) {
      // Add blur class to root div
      const rootElement = document.getElementById('__next') || document.querySelector('body > div:first-child');
      if (rootElement) {
        rootElement.style.filter = 'blur(4px)';
        rootElement.style.transition = 'filter 0.3s ease-in-out';
      }
      // Prevent scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Remove blur
      const rootElement = document.getElementById('__next') || document.querySelector('body > div:first-child');
      if (rootElement) {
        rootElement.style.filter = '';
      }
      document.body.style.overflow = '';
    }

    return () => {
      const rootElement = document.getElementById('__next') || document.querySelector('body > div:first-child');
      if (rootElement) {
        rootElement.style.filter = '';
      }
      document.body.style.overflow = '';
    };
  }, [showThemeMenu]);

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] animate-in fade-in duration-300"
      onClick={() => setShowThemeMenu(false)}
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div 
          className="bg-white rounded-lg shadow-2xl w-full max-w-sm animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
          style={{ 
            backgroundColor: colors.bg.card,
            border: `1px solid ${colors.border.primary}`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor: colors.border.secondary }}>
            <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
              Seleziona tema
            </h2>
          </div>

          {/* Theme List */}
          <div className="p-2 max-h-96 overflow-y-auto">
            {availableThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => {
                  setTheme(theme.id);
                  setShowThemeMenu(false);
                }}
                className="w-full p-3 rounded-lg mb-1 flex items-center gap-3 transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: currentTheme.id === theme.id ? colors.bg.hover : 'transparent',
                  color: colors.text.primary
                }}
                onMouseEnter={(e) => {
                  if (currentTheme.id !== theme.id) {
                    e.currentTarget.style.backgroundColor = colors.bg.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentTheme.id !== theme.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {/* Color preview */}
                <div className="flex -space-x-2">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white"
                    style={{ 
                      backgroundColor: theme.colors[resolvedMode].bg.dark,
                      borderColor: colors.bg.card
                    }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white"
                    style={{ 
                      backgroundColor: theme.colors[resolvedMode].accent || theme.colors[resolvedMode].button.primary,
                      borderColor: colors.bg.card
                    }}
                  />
                </div>

                {/* Theme name */}
                <span className="flex-1 text-left">{theme.name}</span>

                {/* Active indicator */}
                {currentTheme.id === theme.id && (
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: colors.button.success }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t" style={{ borderColor: colors.border.secondary }}>
            <button
              onClick={() => setShowThemeMenu(false)}
              className="w-full py-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: colors.bg.hover,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.darker;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Button */}
      <button
        onClick={() => setShowThemeMenu(true)}
        className={`p-2 rounded-lg transition-colors hover:scale-105 ${className}`}
        style={{ 
          backgroundColor: 'transparent',
          color: colors.text.secondary
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.bg.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="Seleziona tema"
      >
        <Palette className="h-5 w-5" />
      </button>

      {/* Modal rendered via portal */}
      {showThemeMenu && mounted && createPortal(modalContent, document.body)}
    </>
  );
}