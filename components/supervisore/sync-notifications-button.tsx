"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { syncOrderNotifications } from "@/lib/actions/sync-order-notifications";
import { toast } from "@/lib/toast";

export function SyncNotificationsButton() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await syncOrderNotifications();
      
      if (result.success) {
        toast.success(result.message || "Notifiche sincronizzate con successo");
      } else {
        toast.error(result.error || "Errore durante la sincronizzazione");
      }
    } catch (error) {
      console.error("Errore sincronizzazione:", error);
      toast.error("Errore imprevisto durante la sincronizzazione");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        isSyncing 
          ? "bg-gray-600 cursor-not-allowed opacity-50" 
          : "bg-blue-600 hover:bg-blue-700"
      } text-white`}
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Sincronizzazione..." : "Sincronizza Notifiche"}
    </button>
  );
}