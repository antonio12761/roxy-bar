"use client";

import { Bell, Coffee, Wifi, WifiOff } from "lucide-react";
import UserDisplay from "@/components/UserDisplay";
import { CameriereProvider, useCameriere } from "@/contexts/cameriere-context";
import { useRouter, usePathname } from "next/navigation";
import { markAllNotificationsAsRead } from "@/lib/utils/notification-sync";

function CameriereLayoutContent({ children }: { children: React.ReactNode }) {
  const { isConnected, notificationCount, resetNotificationCount } = useCameriere();
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-slate-700 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Roxy Bar Logo & Brand */}
            <button 
              onClick={() => {
                console.log('[Layout] Navigating to /cameriere from:', pathname);
                
                // For ordini-in-corso page, use window.location to avoid conflicts
                if (pathname === '/cameriere/ordini-in-corso') {
                  console.log('[Layout] Using window.location for ordini-in-corso');
                  window.location.href = '/cameriere';
                } else {
                  // For other pages, try router first
                  try {
                    router.push('/cameriere');
                  } catch (error) {
                    console.error('[Layout] Router error:', error);
                    window.location.href = '/cameriere';
                  }
                }
              }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-white/10 to-white/20 rounded-lg shadow-lg">
                <Coffee className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white/70">ROXY BAR</h1>
            </button>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
                isConnected 
                  ? "bg-white/10/20 text-white/60" 
                  : "bg-white/8/20 text-white/50"
              }`}>
                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span>{isConnected ? "Online" : "Offline"}</span>
              </div>

              {/* Notification Bell */}
              <button
                onClick={handleNotificationClick}
                className="relative p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Bell className="h-6 w-6 text-muted-foreground hover:text-white/70" />
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

      {/* Page Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

export default function CameriereLayout({
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