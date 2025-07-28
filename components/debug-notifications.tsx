"use client";

import { useState } from "react";
import { testWaiterNotification, checkSSEConnection } from "@/lib/actions/test-notifications";
import { toast } from "@/lib/toast";
import { Bell, Wifi, Send } from "lucide-react";

export function DebugNotifications({ notifications }: { notifications: any[] }) {
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStats, setConnectionStats] = useState<any>(null);

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const result = await testWaiterNotification();
      if (result.success) {
        toast.success(result.message || "Test notification sent!");
      } else {
        toast.error(result.error || "Failed to send test notification");
      }
    } catch (error) {
      toast.error("Error sending test notification");
    } finally {
      setIsTesting(false);
    }
  };

  const handleCheckConnection = async () => {
    try {
      const result = await checkSSEConnection();
      if (result.success) {
        setConnectionStats(result.stats);
      } else {
        toast.error(result.error || "Failed to check connection");
      }
    } catch (error) {
      toast.error("Error checking connection");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-800 border border-slate-600 rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Debug Notifications
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleTestNotification}
            disabled={isTesting}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Send test notification"
          >
            <Send className={`h-4 w-4 ${isTesting ? 'text-gray-400' : 'text-white/60'}`} />
          </button>
          <button
            onClick={handleCheckConnection}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Check SSE connection"
          >
            <Wifi className="h-4 w-4 text-white/60" />
          </button>
        </div>
      </div>

      {connectionStats && (
        <div className="mb-3 p-2 bg-slate-700 rounded text-xs">
          <div className="text-white/60">SSE Connection Stats:</div>
          <div>Total clients: {connectionStats.totalClients}</div>
          <div>Your connections: {connectionStats.userConnections}</div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Recent notifications ({notifications.length}):
        </div>
        {notifications.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            No notifications received yet
          </div>
        ) : (
          notifications.slice(0, 10).map((notif, idx) => (
            <div key={idx} className="p-2 bg-slate-700 rounded text-xs">
              <div className="flex justify-between items-start">
                <div className="font-medium text-white/70">{notif.type}</div>
                <div className="text-muted-foreground text-[10px]">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="text-foreground mt-1">{notif.message}</div>
              {notif.data && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Data
                  </summary>
                  <pre className="text-[10px] overflow-x-auto mt-1">
                    {JSON.stringify(notif.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}