"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface CameriereContextType {
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  notificationCount: number;
  setNotificationCount: (count: number) => void;
  incrementNotificationCount: () => void;
  resetNotificationCount: () => void;
}

const CameriereContext = createContext<CameriereContextType | undefined>(undefined);

export function CameriereProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Sync with NotificationCenter's unread count
  useEffect(() => {
    const updateCountFromStorage = () => {
      try {
        const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        const allNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
        const unreadCount = allNotifications.filter((n: any) => !readNotifications.includes(n.id)).length;
        setNotificationCount(unreadCount);
      } catch (error) {
        console.error('Error syncing notification count:', error);
      }
    };

    // Initial sync
    updateCountFromStorage();

    // Listen for storage changes (from other tabs/components)
    window.addEventListener('storage', updateCountFromStorage);
    
    // Listen for custom notification events
    window.addEventListener('notificationCountChanged', updateCountFromStorage);

    return () => {
      window.removeEventListener('storage', updateCountFromStorage);
      window.removeEventListener('notificationCountChanged', updateCountFromStorage);
    };
  }, []);

  const incrementNotificationCount = () => {
    setNotificationCount(prev => prev + 1);
  };

  const resetNotificationCount = () => {
    setNotificationCount(0);
    // Dispatch custom event to sync with other components
    window.dispatchEvent(new CustomEvent('notificationCountChanged'));
  };

  return (
    <CameriereContext.Provider value={{ 
      isConnected, 
      setIsConnected, 
      notificationCount, 
      setNotificationCount,
      incrementNotificationCount,
      resetNotificationCount
    }}>
      {children}
    </CameriereContext.Provider>
  );
}

export function useCameriere() {
  const context = useContext(CameriereContext);
  if (context === undefined) {
    throw new Error('useCameriere must be used within a CameriereProvider');
  }
  return context;
}