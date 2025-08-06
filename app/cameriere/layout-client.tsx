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
import NotificationCenter from "@/components/NotificationCenter";
import { SSEInitializer } from "@/components/cameriere/SSEInitializer";
// import SSEDebugger from "@/components/SSEDebugger";
import type { AuthUser } from "@/lib/auth-multi-tenant";

interface CameriereLayoutContentProps {
  children: React.ReactNode;
  user: AuthUser | null;
}

function CameriereLayoutContent({ children, user }: CameriereLayoutContentProps) {
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
                <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>Roxy Bar</h1>
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

              {/* Notification Center with Bell */}
              <NotificationCenter userRole="CAMERIERE" />

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
      
      {/* SSE Debugger (only in development) */}
      {/* {process.env.NODE_ENV === 'development' && <SSEDebugger />} */}
    </div>
  );
}

export default function CameriereLayoutClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthUser | null;
}) {
  return (
    <CameriereProvider>
      <SSEInitializer />
      <CameriereLayoutContent user={user}>{children}</CameriereLayoutContent>
    </CameriereProvider>
  );
}