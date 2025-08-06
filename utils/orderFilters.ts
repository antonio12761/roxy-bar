import type { Ordinazione } from '@/app/prepara/types';

export function getFilteredOrders(
  orders: Ordinazione[], 
  activeTab: 'esauriti' | 'attesa' | 'preparazione' | 'pronti' | 'ritirati'
): Ordinazione[] {
  switch (activeTab) {
    case 'esauriti':
      const esauriti = orders.filter(o => o.stato === 'ORDINATO_ESAURITO');
      console.log('[Filter] Tab esauriti - Total orders:', orders.length, 'Esauriti:', esauriti.length);
      if (orders.length > 0) {
        console.log('[Filter] Sample order states:', orders.slice(0, 3).map(o => ({ id: o.id, stato: o.stato })));
      }
      return esauriti;
    case 'attesa':
      return orders.filter(o => 
        o.stato === 'ORDINATO' && o.items.some(i => i.stato === 'INSERITO')
      );
    case 'preparazione':
      return orders.filter(o => o.stato === 'IN_PREPARAZIONE');
    case 'pronti':
      return orders.filter(o => 
        (o.stato === 'PRONTO' || o.items.every(i => i.stato === 'PRONTO')) && 
        o.stato !== 'CONSEGNATO'
      );
    case 'ritirati':
      return orders.filter(o => o.stato === 'CONSEGNATO');
    default:
      return [];
  }
}