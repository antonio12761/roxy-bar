'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSE } from '@/contexts/sse-context';
import { toast } from 'sonner';
import { OutOfStockNotificationData } from '@/components/cameriere/OutOfStockNotificationClaim';

interface UseOutOfStockNotificationsOptions {
  currentUserId: string;
  currentUserName: string;
}

export function useOutOfStockNotifications({ 
  currentUserId, 
  currentUserName 
}: UseOutOfStockNotificationsOptions) {
  const sseContext = useSSE();
  const [notifications, setNotifications] = useState<OutOfStockNotificationData[]>([]);
  const notificationIdsRef = useRef<Set<string>>(new Set());
  const unsubscribeRef = useRef<(() => void)[]>([]);

  // Subscribe to SSE events
  useEffect(() => {
    if (!sseContext) return;

    // Subscribe to out-of-stock notification events
    const unsubNotification = sseContext.subscribe('out-of-stock:notification', (data) => {
      const notificationData = data as OutOfStockNotificationData;
        
      // Avoid duplicate notifications
      if (!notificationIdsRef.current.has(notificationData.id)) {
        notificationIdsRef.current.add(notificationData.id);
        
        setNotifications(prev => {
          // Check if notification already exists
          const exists = prev.some(n => n.id === notificationData.id);
          if (exists) return prev;
          
          // Add new notification
          return [...prev, notificationData];
        });

        // Play notification sound
        playNotificationSound();
      }
    });

    // Subscribe to claimed events
    const unsubClaimed = sseContext.subscribe('out-of-stock:claimed', (data) => {
      const { notificationId, claimedBy, claimedAt } = data;
      
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId
            ? { ...notification, claimedBy, claimedAt }
            : notification
        )
      );
    });

    // Subscribe to dismissed events
    const unsubDismissed = sseContext.subscribe('out-of-stock:dismissed', (data) => {
      const { notificationId } = data;
      
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
      
      // Remove from tracked IDs
      notificationIdsRef.current.delete(notificationId);
    });

    // Store unsubscribe functions
    unsubscribeRef.current = [unsubNotification, unsubClaimed, unsubDismissed];

    // Cleanup on unmount
    return () => {
      unsubscribeRef.current.forEach(unsub => unsub());
    };
  }, [sseContext]);

  // Claim a notification
  const claimNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId,
          userId: currentUserId,
          userName: currentUserName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to claim notification');
      }

      const result = await response.json();

      // Update local state immediately
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId
            ? { 
                ...notification, 
                claimedBy: currentUserName, 
                claimedAt: new Date() 
              }
            : notification
        )
      );

      toast.success('Notifica presa in carico');
    } catch (error) {
      console.error('Error claiming notification:', error);
      toast.error('Errore nel prendere in carico la notifica');
      throw error;
    }
  }, [currentUserId, currentUserName]);

  // Dismiss a notification
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
    
    // Remove from tracked IDs
    notificationIdsRef.current.delete(notificationId);

    // Note: dismissal is local only, no need to sync with other clients
  }, []);

  // Get unclaimed notifications
  const unclaimedNotifications = notifications.filter(n => !n.claimedBy);

  // Get notifications claimed by current user
  const myClaimedNotifications = notifications.filter(
    n => n.claimedBy === currentUserName
  );

  // Get notifications claimed by others
  const othersClaimedNotifications = notifications.filter(
    n => n.claimedBy && n.claimedBy !== currentUserName
  );

  return {
    notifications,
    unclaimedNotifications,
    myClaimedNotifications,
    othersClaimedNotifications,
    claimNotification,
    dismissNotification,
  };
}

// Helper function to play notification sound
function playNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {
      // Fallback: use Web Audio API
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch (e) {
        console.log('Could not play notification sound');
      }
    });
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}