"use server";

import { notifyNewOrder, notifyOrderUpdate } from "@/lib/notifications";

interface OrderItem {
  prodotto: {
    id: string;
    nome: string;
    prezzo: number;
    categoria: string;
  };
  quantita: number;
}

export async function submitOrder(
  tableNumber: number,
  items: OrderItem[]
) {
  try {
    // Simula salvataggio nel database
    console.log("📋 Nuovo ordine:", {
      tavolo: tableNumber,
      articoli: items,
      totale: items.reduce((sum, item) => sum + (item.prodotto.prezzo * item.quantita), 0)
    });

    // Invia notifica SSE a cucina/prepara
    notifyNewOrder(tableNumber, items);

    // Simula ID ordine generato
    const orderId = `ORD-${Date.now()}`;
    
    return {
      success: true,
      orderId,
      message: `Ordine inviato per Tavolo ${tableNumber}`
    };

  } catch (error) {
    console.error("Errore invio ordine:", error);
    return {
      success: false,
      error: "Errore durante l'invio dell'ordine"
    };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  tableNumber: number
) {
  try {
    console.log("🔄 Aggiornamento ordine:", { orderId, status, tableNumber });

    // Notifica cambio stato
    notifyOrderUpdate(orderId, status, tableNumber);

    return {
      success: true,
      message: `Ordine ${orderId} aggiornato a ${status}`
    };

  } catch (error) {
    console.error("Errore aggiornamento ordine:", error);
    return {
      success: false,
      error: "Errore durante l'aggiornamento dell'ordine"
    };
  }
}

// Simula ordini di test per dimostrare le notifiche
export async function sendTestNotification() {
  const testItems = [
    { prodotto: { id: "1", nome: "Caffè", prezzo: 1.20, categoria: "CAFFETTERIA" }, quantita: 2 },
    { prodotto: { id: "2", nome: "Cornetto", prezzo: 1.50, categoria: "FOOD_SNACKS" }, quantita: 1 }
  ];

  notifyNewOrder(5, testItems);
  
  return { success: true, message: "Notifica di test inviata" };
}