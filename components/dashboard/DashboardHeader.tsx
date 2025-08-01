"use client";

import { Bell, Search, User, LogOut, Palette, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebar } from "@/app/dashboard/layout-client";

export default function DashboardHeader() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { currentTheme, themeMode, setTheme, availableThemes } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  const { isCollapsed, setIsCollapsed } = useSidebar();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className="px-4 sm:px-6 py-4 border-b transition-all duration-300"
      style={{
        backgroundColor: isScrolled ? `${colors.bg.card}dd` : colors.bg.card,
        borderColor: colors.border.primary,
        backdropFilter: isScrolled ? 'blur(8px)' : 'none',
        boxShadow: isScrolled ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center flex-1 gap-2 sm:gap-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg transition-all duration-300 hover:opacity-80 lg:hidden flex-shrink-0"
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary,
              border: `1px solid ${colors.border.primary}`
            }}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 max-w-xl">
            <div className="relative w-full">
              <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5" 
                style={{ color: colors.text.muted }}
              />
              <input
                type="text"
                placeholder="Cerca..."
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-1 text-sm"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 hover:opacity-80 transition-all duration-300"
              style={{ color: colors.text.secondary }}
            >
              <Palette className="w-5 h-5" />
            </button>

            {showThemeMenu && (
              <div 
                className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-2 z-50"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <h3 
                  className="px-4 py-2 text-sm font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Seleziona tema
                </h3>
                <div className="max-h-60 overflow-y-auto">
                  {availableThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setTheme(theme.id);
                        setShowThemeMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:opacity-80 transition-colors duration-300 flex items-center gap-2"
                      style={{
                        backgroundColor: currentTheme.id === theme.id ? colors.bg.hover : 'transparent',
                        color: colors.text.primary
                      }}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border"
                        style={{
                          backgroundColor: theme.colors[resolvedMode as 'light' | 'dark'].bg.dark,
                          borderColor: theme.colors[resolvedMode as 'light' | 'dark'].border.primary
                        }}
                      />
                      {theme.name}
                      {theme.description && (
                        <span style={{ color: colors.text.muted, fontSize: '0.75rem' }}>
                          {theme.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            className="relative p-2 hover:opacity-80 transition-all duration-300"
            style={{ color: colors.text.secondary }}
          >
            <Bell className="w-5 h-5" />
            <span 
              className="absolute top-0 right-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: colors.text.error }}
            ></span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:opacity-80 transition-all duration-300"
              style={{ color: colors.text.secondary }}
            >
              <User className="w-5 h-5" />
            </button>

            {showUserMenu && (
              <div 
                className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-2"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <Link
                  href="/dashboard/profilo"
                  className="flex items-center gap-2 px-4 py-2 hover:opacity-80 transition-colors duration-300"
                  style={{ 
                    color: colors.text.primary,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <User className="w-4 h-4" />
                  Profilo
                </Link>
                <hr className="my-2" style={{ borderColor: colors.border.primary }} />
                <button 
                  className="flex items-center gap-2 px-4 py-2 w-full text-left hover:opacity-80 transition-colors duration-300"
                  style={{ 
                    color: colors.text.primary,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <LogOut className="w-4 h-4" />
                  Esci
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}