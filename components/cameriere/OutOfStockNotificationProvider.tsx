'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSE } from '@/contexts/sse-context';
import OutOfStockNotification from './OutOfStockNotification';
import { subscribeToNotificationChanges, notifyNotificationAdded } from '@/lib/utils/notification-sync';
import { EnhancedSSENotification, NotificationPriority, NotificationTypes } from '@/lib/types/notifications';

interface OutOfStockEvent {
  originalOrderId: string;
  originalOrderNumber: number;
  newOrderId: string;
  newOrderNumber: number;
  tableNumber?: string;
  waiterId: string;
  waiterName: string;
  outOfStockProduct: string;
  outOfStockItems: Array<{
    id: string;
    productName: string;
    quantity: number;
  }>;
  timestamp: string;
}

interface ProductAvailabilityEvent {
  productId: number;
  productName: string;
  available: boolean;
  updatedBy: string;
  timestamp: string;
}

export default function OutOfStockNotificationProvider({ 
  children,
  currentUserId,
  availableProducts
}: { 
  children: React.ReactNode;
  currentUserId: string;
  availableProducts: Array<{
    id: number;
    nome: string;
    prezzo: number;
    categoria: string;
  }>;
}) {
  const sseContext = useSSE();
  const [activeNotification, setActiveNotification] = useState<OutOfStockEvent | null>(null);
  const hasSubscribedRef = useRef(false);

  // Handle out of stock events
  const handleOutOfStock = useCallback((data: any) => {
    console.log('[OutOfStockProvider] Received out-of-stock event:', data);
    
    // Check if this event is for the current user
    if (data.waiterId === currentUserId) {
      const eventData = data as OutOfStockEvent;
      
      // Create notification for NotificationCenter
      const notification: EnhancedSSENotification = {
        id: `out-of-stock-${eventData.originalOrderId}-${Date.now()}`,
        type: NotificationTypes.ORDER_OUT_OF_STOCK,
        message: `ATTENZIONE: ${eventData.outOfStockProduct} è esaurito! Ordine #${eventData.originalOrderNumber}`,
        priority: NotificationPriority.URGENT,
        timestamp: new Date().toISOString(),
        data: {
          ...eventData,
          tableNumber: eventData.tableNumber
        },
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      // Add to notification center
      notifyNotificationAdded(notification);

      // Set the active notification to show the modal
      setActiveNotification(eventData);
    }
  }, [currentUserId]);

  // Handle product availability changes
  const handleProductAvailability = useCallback((data: any) => {
    console.log('[OutOfStockProvider] Received product availability update:', data);
    
    const eventData = data as ProductAvailabilityEvent;
    
    // Create notification for NotificationCenter
    const notification: EnhancedSSENotification = {
      id: `availability-${data.productId}-${Date.now()}`,
      type: NotificationTypes.ORDER_UPDATE,
      message: eventData.available 
        ? `${eventData.productName} è ora DISPONIBILE`
        : `${eventData.productName} è stato segnato come ESAURITO`,
      priority: eventData.available ? NotificationPriority.NORMAL : NotificationPriority.HIGH,
      timestamp: new Date().toISOString(),
      data: {
        productId: eventData.productId,
        productName: eventData.productName,
        available: eventData.available,
        updatedBy: eventData.updatedBy
      },
      targetRoles: ['CAMERIERE'],
      syncVersion: Date.now()
    };
    
    // Add to notification center
    notifyNotificationAdded(notification);
  }, []);

  // DISABLED - All subscriptions are now handled by NotificationCenter
  // This component now only handles the OutOfStockNotification modal
  useEffect(() => {
    console.log('[OutOfStockProvider] Subscriptions disabled - handled by NotificationCenter');
    // Listen for custom events from NotificationCenter if needed
  }, []);

  const handleClose = () => {
    setActiveNotification(null);
  };

  const handleReplaceProduct = async (substituteProductId: number) => {
    if (!activeNotification) return;
    
    try {
      // Here you would call your server action to replace the product
      // For now, we'll just close the modal
      const notification: EnhancedSSENotification = {
        id: `replace-success-${Date.now()}`,
        type: NotificationTypes.ORDER_UPDATE,
        message: 'Prodotto sostituito con successo',
        priority: NotificationPriority.NORMAL,
        timestamp: new Date().toISOString(),
        data: {},
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      notifyNotificationAdded(notification);
      setActiveNotification(null);
    } catch (error) {
      const notification: EnhancedSSENotification = {
        id: `replace-error-${Date.now()}`,
        type: NotificationTypes.ORDER_FAILED,
        message: 'Errore nella sostituzione del prodotto',
        priority: NotificationPriority.HIGH,
        timestamp: new Date().toISOString(),
        data: {},
        targetRoles: ['CAMERIERE'],
        syncVersion: Date.now()
      };
      
      notifyNotificationAdded(notification);
    }
  };

  return (
    <>
      {children}
      {activeNotification && (
        <OutOfStockNotification
          notification={activeNotification}
          onClose={handleClose}
          availableProducts={availableProducts}
        />
      )}
    </>
  );
}