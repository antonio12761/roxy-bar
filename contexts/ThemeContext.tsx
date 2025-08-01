"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ThemeDefinition, ThemeMode } from "@/theme/theme-types";
import { getAllThemes, getDefaultTheme } from "@/theme/theme-registry";

interface ThemeContextType {
  currentTheme: ThemeDefinition;
  themeMode: ThemeMode;
  setTheme: (themeId: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(getDefaultTheme());
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const availableThemes = getAllThemes();

  useEffect(() => {
    // Carica il tema salvato
    const savedThemeId = localStorage.getItem("selectedTheme");
    const savedThemeMode = localStorage.getItem("themeMode") as ThemeMode;
    
    if (savedThemeId) {
      const theme = availableThemes.find(t => t.id === savedThemeId);
      if (theme) setCurrentTheme(theme);
    }
    
    if (savedThemeMode) {
      setThemeMode(savedThemeMode);
    }
  }, []);

  const setTheme = (themeId: string) => {
    const theme = availableThemes.find(t => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
      localStorage.setItem("selectedTheme", themeId);
    }
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("themeMode", mode);
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeMode,
        setTheme,
        setThemeMode: handleSetThemeMode,
        availableThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}