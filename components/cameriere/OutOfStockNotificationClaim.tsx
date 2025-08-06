'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export interface OutOfStockNotificationData {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  table: string;
  customerName: string;
  timestamp: Date;
  claimedBy?: string;
  claimedAt?: Date;
}

interface OutOfStockNotificationClaimProps {
  notification: OutOfStockNotificationData;
  onClaim: (notificationId: string) => Promise<void>;
  onDismiss: (notificationId: string) => void;
  currentUser: string;
}

export const OutOfStockNotificationClaim: React.FC<OutOfStockNotificationClaimProps> = ({
  notification,
  onClaim,
  onDismiss,
  currentUser
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);

  useEffect(() => {
    if (notification.claimedBy) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          onDismiss(notification.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [notification.id, notification.claimedBy, onDismiss]);

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      await onClaim(notification.id);
    } catch (error) {
      console.error('Errore nel prendere in carico la notifica:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isClaimedByOther = notification.claimedBy && notification.claimedBy !== currentUser;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="fixed top-4 right-4 z-50 max-w-md"
      >
        <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-950/50 shadow-xl">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-red-900 dark:text-red-100">
                    Prodotto Esaurito
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {format(new Date(notification.timestamp), 'HH:mm', { locale: it })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onDismiss(notification.id)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {notification.itemName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Quantità: {notification.quantity}
                </p>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tavolo</p>
                  <p className="font-semibold text-lg">{notification.table}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cliente</p>
                  <p className="font-semibold">{notification.customerName}</p>
                </div>
              </div>
            </div>

            {isClaimedByOther ? (
              <div className="flex items-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Preso in carico da <span className="font-semibold">{notification.claimedBy}</span>
                </p>
              </div>
            ) : !notification.claimedBy ? (
              <>
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Auto-dismissione in:
                    </p>
                    <p className="text-xs font-semibold text-red-600">
                      {timeRemaining}s
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <motion.div
                      className="bg-red-500 h-1.5 rounded-full"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(timeRemaining / 30) * 100}%` }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleClaim}
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3"
                >
                  {isLoading ? 'Presa in carico...' : 'Gestisco io'}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Hai preso in carico questa notifica
                </p>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};