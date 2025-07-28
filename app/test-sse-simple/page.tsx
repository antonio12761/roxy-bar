"use client";

import { useEffect, useState } from "react";

export default function TestSSESimplePage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🔌 Attempting to connect to test SSE endpoint...");
    
    const eventSource = new EventSource('/api/test-sse');
    
    eventSource.onopen = () => {
      console.log("✅ Test SSE connected!");
      setIsConnected(true);
      setError(null);
    };
    
    eventSource.onmessage = (event) => {
      console.log("📨 Test SSE message:", event.data);
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data].slice(-10)); // Keep last 10 messages
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };
    
    eventSource.onerror = (event) => {
      console.error("❌ Test SSE error:", event);
      setIsConnected(false);
      setError("Connection failed");
    };
    
    return () => {
      console.log("🔌 Disconnecting test SSE");
      eventSource.close();
    };
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple SSE Test</h1>
      
      <div className={`p-4 rounded mb-4 ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
        <p className="font-semibold">
          Connection Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </p>
        {error && <p className="text-red-600 mt-2">Error: {error}</p>}
      </div>
      
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">Messages:</h2>
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-gray-500">No messages received yet...</p>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="bg-white p-2 rounded text-sm">
                <div className="font-medium">{msg.type}</div>
                <div>{msg.message}</div>
                <div className="text-xs text-gray-500">{msg.timestamp}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}