"use client";

import React from "react";
import NotificationCenter from "@/components/NotificationCenter";
import { NotificationPreferencesProvider } from "@/lib/contexts/NotificationPreferencesContext";

interface NotificationIntegrationProps {
  userRole: string;
}

/**
 * Example component showing how to integrate the notification system
 * This should be added to your main layout or navigation component
 */
export default function NotificationIntegration({ userRole }: NotificationIntegrationProps) {
  return (
    <NotificationPreferencesProvider>
      <div className="flex items-center">
        {/* Add this to your navigation bar or header */}
        <NotificationCenter userRole={userRole} />
      </div>
    </NotificationPreferencesProvider>
  );
}

/**
 * Usage example in your layout:
 * 
 * import NotificationIntegration from "@/components/NotificationIntegration";
 * 
 * export default function Layout({ children }) {
 *   const user = await getCurrentUser();
 *   
 *   return (
 *     <div>
 *       <header>
 *         <nav>
 *           // ... other nav items
 *           <NotificationIntegration userRole={user.ruolo} />
 *         </nav>
 *       </header>
 *       <main>{children}</main>
 *     </div>
 *   );
 * }
 */