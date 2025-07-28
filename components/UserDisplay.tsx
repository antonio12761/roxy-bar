"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";

interface UserDisplayProps {
  className?: string;
}

export default function UserDisplay({ className = "" }: UserDisplayProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
      >
        {currentUser.nome}
        <ChevronDown className={`h-3 w-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}