"use client";

import { useState, createContext, useContext } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useTheme } from "@/contexts/ThemeContext";

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within SidebarProvider");
  return context;
};

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="relative min-h-screen transition-colors duration-300" style={{ backgroundColor: colors.bg.darker }}>
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
          <DashboardSidebar />
        </aside>
        
        {/* Mobile overlay when sidebar is open */}
        {!isCollapsed && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsCollapsed(true)}
          />
        )}
        
        {/* Main content */}
        <div className={`transition-all duration-300 ${isCollapsed ? 'pl-16' : 'pl-64'}`}>
          <div className="flex flex-col min-h-screen">
            <div className="sticky top-0 z-30">
              <DashboardHeader />
            </div>
            <main className="flex-1 p-4 sm:p-6 lg:p-8" style={{ backgroundColor: colors.bg.darker }}>
              <div 
                className="rounded-lg p-6 min-h-full transition-colors duration-300"
                style={{ 
                  backgroundColor: colors.bg.card,
                  color: colors.text.primary
                }}
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}