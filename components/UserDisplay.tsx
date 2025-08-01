"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { useTheme } from "@/contexts/ThemeContext";

interface UserDisplayProps {
  className?: string;
}

export default function UserDisplay({ className = "" }: UserDisplayProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('user');
    
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setCurrentUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Pulisci i dati utente dal localStorage
      localStorage.removeItem('user');
      localStorage.clear();
      sessionStorage.clear();
      
      await logout();
      router.push("/login");
    } catch (error) {
      console.error('Errore durante il logout:', error);
      // Forza il redirect anche in caso di errore
      router.push("/login");
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
        style={{ 
          backgroundColor: colors.bg.card,
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: colors.border.primary
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.bg.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.bg.card;
        }}
      >
        <User className="h-5 w-5" style={{ color: colors.text.secondary }} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-lg py-2 z-50" style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}>
          <div className="px-4 py-2 border-b" style={{ borderColor: colors.border.primary }}>
            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
              {currentUser.nome}
            </p>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              {currentUser.email || 'Cameriere'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: colors.text.primary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}