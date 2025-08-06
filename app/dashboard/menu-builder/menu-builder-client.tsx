"use client";

import React from 'react';

interface MenuBuilderClientProps {
  initialGroups: any[];
  availableProducts: any[];
}

export default function MenuBuilderClient({ 
  initialGroups, 
  availableProducts 
}: MenuBuilderClientProps) {
  return (
    <div className="space-y-4">
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-lg font-semibold mb-4">Menu Builder</h2>
        <p className="text-muted-foreground">
          Funzionalità in fase di sviluppo
        </p>
        <div className="mt-4 space-y-2">
          <div className="text-sm text-muted-foreground">
            Gruppi disponibili: {initialGroups.length}
          </div>
          <div className="text-sm text-muted-foreground">
            Prodotti disponibili: {availableProducts.length}
          </div>
        </div>
      </div>
    </div>
  );
}