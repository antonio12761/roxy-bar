"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useEffect } from "react";

export default function ThemeBodyWrapper({ children }: { children: React.ReactNode }) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  useEffect(() => {
    // Apply theme colors to body
    document.body.style.backgroundColor = colors.bg.dark;
    document.body.style.color = colors.text.primary;
    
    // Apply theme mode class
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    
    return () => {
      // Cleanup
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    };
  }, [colors, themeMode]);

  return <>{children}</>;
}