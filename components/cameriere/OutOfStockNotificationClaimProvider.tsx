'use client';

import React, { useCallback } from 'react';
import { useOutOfStockNotifications } from '@/hooks/useOutOfStockNotifications';
import { OutOfStockNotificationClaim } from './OutOfStockNotificationClaim';
import { claimOutOfStockNotification } from '@/lib/actions/out-of-stock-notifications';
import { toast } from '@/lib/toast';
import type { AuthUser } from '@/lib/auth-multi-tenant';

interface OutOfStockNotificationClaimProviderProps {
  children: React.ReactNode;
  user: AuthUser | null;
}

export const OutOfStockNotificationClaimProvider: React.FC<OutOfStockNotificationClaimProviderProps> = ({
  children,
  user,
}) => {
  const currentUserId = user?.id || '';
  const currentUserName = user?.nome || 'Unknown';

  const {
    unclaimedNotifications,
    dismissNotification,
  } = useOutOfStockNotifications({
    currentUserId,
    currentUserName,
  });

  const handleClaim = useCallback(async (notificationId: string) => {
    try {
      const result = await claimOutOfStockNotification(notificationId, currentUserName);
      if (result.success) {
        toast.success('Hai preso in carico la notifica');
      } else {
        toast.error(result.error || 'Errore nella presa in carico');
      }
    } catch (error) {
      toast.error('Errore imprevisto');
    }
  }, [currentUserName]);

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {unclaimedNotifications.map((notification) => (
          <OutOfStockNotificationClaim
            key={notification.id}
            notification={notification}
            onClaim={handleClaim}
            onDismiss={dismissNotification}
            currentUser={currentUserName}
          />
        ))}
      </div>
    </>
  );
};