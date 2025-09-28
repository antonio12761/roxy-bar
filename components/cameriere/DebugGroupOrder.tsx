'use client';

import { useEffect, useState } from 'react';

export function DebugGroupOrder({ tables }: { tables: any[] }) {
  const [groupsOrder, setGroupsOrder] = useState<string[]>([]);

  useEffect(() => {
    const groups: string[] = [];
    const seen = new Set<string>();
    
    tables.forEach(table => {
      const groupName = table.GruppoTavoli?.nome || 'Senza Gruppo';
      if (!seen.has(groupName)) {
        seen.add(groupName);
        groups.push(groupName);
      }
    });
    
    setGroupsOrder(groups);
    console.log('=== DEBUG GROUP ORDER ===');
    console.log('Total tables:', tables.length);
    console.log('Groups order:', groups);
    console.log('First 5 tables:', tables.slice(0, 5).map(t => ({
      numero: t.numero,
      gruppo: t.GruppoTavoli?.nome,
      ordinamento: t.GruppoTavoli?.ordinamento
    })));
  }, [tables]);

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">Debug Ordine Gruppi:</div>
      {groupsOrder.map((group, i) => (
        <div key={group}>{i + 1}. {group}</div>
      ))}
    </div>
  );
}