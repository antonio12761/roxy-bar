"use client";

import { useSSE } from "@/lib/hooks/useSSE";
import { useState, useEffect } from "react";
import { testWaiterNotification, checkSSEConnection } from "@/lib/actions/test-notifications";
import { Wifi, WifiOff, Send, RefreshCw } from "lucide-react";

export default function TestSSEPage() {
  const [role, setRole] = useState("CAMERIERE");
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  
  const { notifications, isConnected, lastNotification } = useSSE({
    clientId: `test-sse-${role}`,
    userRole: role,
    onNotification: (notif) => {
      console.log("📨 Notification received:", notif);
    }
  });

  useEffect(() => {
    // Check connection status every 5 seconds
    const interval = setInterval(async () => {
      const info = await checkSSEConnection();
      if (info.success) {
        setConnectionInfo(info.stats);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSendTest = async () => {
    const result = await testWaiterNotification();
    console.log("Test result:", result);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">SSE Test Page</h1>
      
      <div className="bg-card border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Connection Status</h2>
        <div className="flex items-center gap-4 mb-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded ${
            isConnected ? "bg-white/10/20 text-white/60" : "bg-white/8/20 text-white/50"
          }`}>
            {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
          
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
            className="px-3 py-1 bg-background border rounded"
          >
            <option value="CAMERIERE">Cameriere</option>
            <option value="PREPARA">Prepara</option>
            <option value="CASSA">Cassa</option>
            <option value="SUPERVISORE">Supervisore</option>
          </select>
        </div>
        
        {connectionInfo && (
          <div className="text-sm text-muted-foreground">
            <div>Total SSE clients: {connectionInfo.totalClients}</div>
            <div>Your connections: {connectionInfo.userConnections}</div>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Test Actions</h2>
        <button
          onClick={handleSendTest}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          <Send className="h-4 w-4" />
          Send Test Notification
        </button>
      </div>

      <div className="bg-card border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Last Notification</h2>
        {lastNotification ? (
          <div className="space-y-2">
            <div><strong>Type:</strong> {lastNotification.type}</div>
            <div><strong>Message:</strong> {lastNotification.message}</div>
            <div><strong>Time:</strong> {new Date(lastNotification.timestamp).toLocaleTimeString()}</div>
            {lastNotification.data && (
              <details>
                <summary className="cursor-pointer">Data</summary>
                <pre className="text-xs bg-background p-2 rounded mt-2">
                  {JSON.stringify(lastNotification.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground">No notifications received yet</div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">All Notifications ({notifications.length})</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notifications.map((notif, idx) => (
            <div key={idx} className="p-2 bg-background rounded text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{notif.type}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-muted-foreground">{notif.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}