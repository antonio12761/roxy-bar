'use client';

import { useState, useEffect, useRef } from 'react';
import { useSSE } from '@/contexts/sse-context';

export default function SSEDebugger() {
  const sseContext = useSSE();
  const [events, setEvents] = useState<any[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const subscribedRef = useRef(false);
  
  useEffect(() => {
    if (!sseContext?.subscribe || subscribedRef.current) {
      return;
    }
    
    subscribedRef.current = true;
    console.log('[SSEDebugger] Setting up universal event listener');
    
    // Listen to ALL events for debugging - COMPREHENSIVE LIST
    const eventTypes = [
      'order:esaurito:alert',
      'order:esaurito:taken', 
      'order:esaurito:released',
      'product:availability',
      'product:unavailable-in-order',
      'product:unavailable-urgent',
      'product:out-of-stock',
      'order:update',
      'order:new',
      'order:ready',
      'order:delivered',
      'order:out-of-stock',
      'notification:new',
      'connection:status',
      'system:heartbeat'
    ];
    
    const unsubscribers = eventTypes.map(eventType => {
      return sseContext.subscribe(eventType as any, (data: any) => {
        const eventLog = {
          type: eventType,
          data,
          timestamp: new Date().toISOString(),
          id: Math.random().toString(36).substr(2, 9)
        };
        
        console.log(`[SSEDebugger] 📡 Event received: ${eventType}`, data);
        
        setEvents(prev => [eventLog, ...prev].slice(0, 20)); // Keep last 20 events
      });
    });
    
    return () => {
      subscribedRef.current = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [sseContext]);
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      width: isMinimized ? 200 : 400,
      maxHeight: isMinimized ? 40 : 500,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: 12,
      padding: 10,
      borderRadius: 5,
      zIndex: 99999,
      overflow: 'auto',
      border: '1px solid #00ff00'
    }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: isMinimized ? 0 : 10,
          cursor: 'pointer'
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <span>SSE Debugger ({events.length})</span>
        <span>{isMinimized ? '▲' : '▼'}</span>
      </div>
      
      {!isMinimized && (
        <>
          <div style={{ marginBottom: 10 }}>
            Status: {sseContext?.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {events.length === 0 ? (
              <div>No events yet...</div>
            ) : (
              events.map(event => (
                <div 
                  key={event.id}
                  style={{ 
                    marginBottom: 10, 
                    padding: 5, 
                    backgroundColor: 'rgba(0, 255, 0, 0.1)',
                    border: '1px solid #00ff00',
                    borderRadius: 3
                  }}
                >
                  <div style={{ color: '#ffff00' }}>
                    {event.type} @ {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <pre style={{ 
                    margin: 0, 
                    fontSize: 10, 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
          
          <button
            onClick={() => setEvents([])}
            style={{
              marginTop: 10,
              padding: '5px 10px',
              backgroundColor: '#ff0000',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}