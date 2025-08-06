'use client';

import React, { useEffect } from 'react';
import { Clock, ChefHat, Check, Package, AlertCircle } from 'lucide-react';
import { TabBookmarks } from '@/components/ui/tab-bookmarks';
import type { Ordinazione } from '@/app/prepara/types';

interface PreparaTabsProps {
  orders: Ordinazione[];
  activeTab: 'esauriti' | 'attesa' | 'preparazione' | 'pronti' | 'ritirati';
  setActiveTab: (tab: 'esauriti' | 'attesa' | 'preparazione' | 'pronti' | 'ritirati') => void;
}

export default function PreparaTabs({ orders, activeTab, setActiveTab }: PreparaTabsProps) {
  const getTabCounts = () => {
    return {
      esauriti: orders.filter(o => o.stato === 'ORDINATO_ESAURITO').length,
      attesa: orders.filter(o => o.stato === 'ORDINATO' && o.items.some(i => i.stato === 'INSERITO')).length,
      preparazione: orders.filter(o => o.stato === 'IN_PREPARAZIONE').length,
      pronti: orders.filter(o => (o.stato === 'PRONTO' || o.items.every(i => i.stato === 'PRONTO')) && o.stato !== 'CONSEGNATO').length,
      ritirati: orders.filter(o => o.stato === 'CONSEGNATO').length
    };
  };

  const counts = getTabCounts();

  // Build tabs array - always show all tabs
  const tabs = [
    {
      id: 'esauriti',
      title: `Esauriti (${counts.esauriti})`,
      icon: AlertCircle,
      isActive: activeTab === 'esauriti',
      onClick: () => setActiveTab('esauriti')
    },
    {
      id: 'attesa',
      title: `Attesa (${counts.attesa})`,
      icon: Clock,
      isActive: activeTab === 'attesa',
      onClick: () => setActiveTab('attesa')
    },
    {
      id: 'preparazione', 
      title: `Preparazione (${counts.preparazione})`,
      icon: ChefHat,
      isActive: activeTab === 'preparazione',
      onClick: () => setActiveTab('preparazione')
    },
    {
      id: 'pronti',
      title: `Pronti (${counts.pronti})`,
      icon: Check,
      isActive: activeTab === 'pronti', 
      onClick: () => setActiveTab('pronti')
    },
    {
      id: 'ritirati',
      title: `Ritirati (${counts.ritirati})`,
      icon: Package,
      isActive: activeTab === 'ritirati',
      onClick: () => setActiveTab('ritirati')
    }
  ];

  return (
    <TabBookmarks 
      tabs={tabs}
      className="mb-0"
    />
  );
}