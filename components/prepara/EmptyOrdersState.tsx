'use client';

import React from 'react';
import { Coffee } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface EmptyOrdersStateProps {
  activeTab: 'attesa' | 'preparazione' | 'pronti' | 'ritirati' | 'esauriti';
}

export default function EmptyOrdersState({ activeTab }: EmptyOrdersStateProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  const getTitle = () => {
    switch (activeTab) {
      case 'attesa': return 'Nessun ordine in attesa';
      case 'preparazione': return 'Nessun ordine in preparazione';
      case 'pronti': return 'Nessun ordine pronto';
      case 'ritirati': return 'Nessun ordine ritirato';
      case 'esauriti': return 'Nessun ordine esaurito';
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'attesa': return 'I nuovi ordini appariranno qui';
      case 'preparazione': return 'Gli ordini in lavorazione appariranno qui';
      case 'pronti': return 'Gli ordini completati appariranno qui';
      case 'ritirati': return 'Gli ordini consegnati appariranno qui';
      case 'esauriti': return 'Gli ordini con prodotti esauriti appariranno qui';
    }
  };

  return (
    <div className="text-center py-12">
      <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
      <p className="text-lg font-medium mb-1" style={{ color: colors.text.primary }}>
        {getTitle()}
      </p>
      <p className="text-sm" style={{ color: colors.text.muted }}>
        {getSubtitle()}
      </p>
    </div>
  );
}