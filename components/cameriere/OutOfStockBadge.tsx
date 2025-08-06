'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OutOfStockBadgeProps {
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export const OutOfStockBadge: React.FC<OutOfStockBadgeProps> = ({
  count,
  size = 'md',
  className,
  showIcon = true,
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant="destructive"
      className={cn(
        'bg-red-500 hover:bg-red-600 text-white border-red-600',
        sizeClasses[size],
        'font-semibold',
        className
      )}
    >
      <span className="flex items-center gap-1">
        {showIcon && (
          <AlertTriangle className={cn(iconSizes[size], 'animate-pulse')} />
        )}
        <span>
          {count !== undefined ? (
            <>Esaurito ({count})</>
          ) : (
            'Esaurito'
          )}
        </span>
      </span>
    </Badge>
  );
};

interface OutOfStockIndicatorProps {
  hasOutOfStock: boolean;
  className?: string;
}

export const OutOfStockIndicator: React.FC<OutOfStockIndicatorProps> = ({
  hasOutOfStock,
  className,
}) => {
  if (!hasOutOfStock) return null;

  return (
    <div
      className={cn(
        'absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full animate-pulse shadow-lg',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-white" />
    </div>
  );
};

interface OutOfStockBorderProps {
  hasOutOfStock: boolean;
  children: React.ReactNode;
  className?: string;
}

export const OutOfStockBorder: React.FC<OutOfStockBorderProps> = ({
  hasOutOfStock,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative',
        hasOutOfStock && 'ring-2 ring-red-500 ring-offset-2',
        className
      )}
    >
      {children}
      {hasOutOfStock && (
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none rounded-lg" />
      )}
    </div>
  );
};