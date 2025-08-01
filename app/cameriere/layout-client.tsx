"use client";

import { Bell, Menu } from "lucide-react";
import UserDisplay from "@/components/UserDisplay";
import { CameriereProvider, useCameriere } from "@/contexts/cameriere-context";
import { useRouter, usePathname } from "next/navigation";
import { markAllNotificationsAsRead } from "@/lib/utils/notification-sync";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import CameriereSidebar from "@/components/cameriere/CameriereSidebar";
import { SSEConnectionStatus } from "@/components/SSEConnectionStatus";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { ThemeSelector } from "@/components/ui/ThemeSelector";

function CameriereLayoutContent({ children }: { children: React.ReactNode }) {
  const { isConnected, notificationCount, resetNotificationCount } = useCameriere();
  const router = useRouter();
  const pathname = usePathname();
  const { currentTheme, themeMode } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  // Abilita swipe gesture per tornare indietro
  useSwipeBack();

  const handleNotificationClick = () => {
    // Mark all notifications as read and sync across components
    markAllNotificationsAsRead();
    resetNotificationCount();
    // TODO: Open notification panel/modal
  };

  const handleBadgeClick = () => {
    // Navigate to orders page when badge is clicked
    router.push('/cameriere/ordini-in-corso');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.dark }}>
      {/* Sidebar */}
      <CameriereSidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
        {/* Fixed Header */}
        <div className="sticky top-0 backdrop-blur-sm z-30" style={{ 
          backgroundColor: colors.bg.dark + 'f2', 
          borderBottom: `1px solid ${colors.border.primary}`,
          paddingTop: 'env(safe-area-inset-top)'
        }}>
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Hamburger menu and App Name */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSidebar(true)}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Menu className="h-6 w-6" style={{ color: colors.text.primary }} />
                </button>
                <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>Siplit</h1>
              </div>

            <div className="flex items-center gap-2">
              {/* Connection Status */}
              <SSEConnectionStatus 
                compact={true}
                showLatency={true}
                showReconnectAttempts={false}
              />

              {/* Theme Selector */}
              <ThemeSelector />

              {/* Notification Bell */}
              <button
                onClick={handleNotificationClick}
                className="relative p-2 rounded-lg transition-colors"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Bell className="h-6 w-6" style={{ color: colors.text.secondary }} />
                {notificationCount > 0 && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBadgeClick();
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors"
                  >
                    {notificationCount}
                  </span>
                )}
              </button>

              {/* User Display */}
              <UserDisplay />
            </div>
          </div>
        </div>
      </div>

      {/* Page Content with responsive padding */}
      <div className="px-3 sm:px-4 md:px-6 py-4">
        {children}
      </div>
    </div>
  );
}

export default function CameriereLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CameriereProvider>
      <CameriereLayoutContent>{children}</CameriereLayoutContent>
    </CameriereProvider>
  );
}