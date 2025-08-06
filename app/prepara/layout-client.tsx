"use client";

import { Bell, Package } from "lucide-react";
import UserDisplay from "@/components/UserDisplay";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import { SSEConnectionStatus } from "@/components/SSEConnectionStatus";
import { ProductsAvailabilityModal } from "@/components/prepara/ProductsAvailabilityModal";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import NotificationCenter from "@/components/NotificationCenter";
// import SSEDebugger from "@/components/SSEDebugger";

export default function PreparaLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentTheme, themeMode } = useTheme();
  const [showProductsAvailabilityModal, setShowProductsAvailabilityModal] = useState(false);
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.dark }}>
      {/* Fixed Header with safe area */}
      <div className="sticky top-0 backdrop-blur-sm z-50" style={{ 
        backgroundColor: colors.bg.dark + 'f2', 
        borderBottom: `1px solid ${colors.border.primary}`,
        paddingTop: 'env(safe-area-inset-top)'
      }}>
        <div className="px-4 sm:px-6 py-4 md:py-6">
          <div className="flex items-center justify-between">
            {/* App Name */}
            <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>Roxy Bar</h1>

            <div className="flex items-center gap-2">
              {/* Connection Status */}
              <SSEConnectionStatus 
                compact={true}
                showLatency={true}
                showReconnectAttempts={false}
              />

              {/* Product Availability Button */}
              <button
                onClick={() => setShowProductsAvailabilityModal(true)}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Gestisci disponibilità prodotti"
              >
                <Package className="h-5 w-5" style={{ color: colors.text.accent }} />
              </button>

              {/* Theme Selector */}
              <ThemeSelector />

              {/* Notification Center */}
              <NotificationCenter userRole="PREPARA" />

              {/* User Display */}
              <UserDisplay />
            </div>
          </div>
        </div>
      </div>

      {/* Page Content with responsive padding */}
      <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
        {children}
      </div>
      
      {/* Products Availability Management Modal */}
      <ProductsAvailabilityModal
        isOpen={showProductsAvailabilityModal}
        onClose={() => setShowProductsAvailabilityModal(false)}
      />
      
      {/* SSE Debugger (only in development) */}
      {/* {process.env.NODE_ENV === 'development' && <SSEDebugger />} */}
    </div>
  );
}