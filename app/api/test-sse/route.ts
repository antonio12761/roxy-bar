import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[TEST-SSE] Connection attempt');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      console.log('[TEST-SSE] Stream started');
      
      // Send initial message
      const message = `data: ${JSON.stringify({ 
        type: 'connection', 
        message: 'Connected to test SSE',
        timestamp: new Date().toISOString() 
      })}\n\n`;
      
      controller.enqueue(encoder.encode(message));
      
      // Send periodic messages
      const interval = setInterval(() => {
        try {
          const testMessage = `data: ${JSON.stringify({ 
            type: 'test', 
            message: 'Test message',
            timestamp: new Date().toISOString() 
          })}\n\n`;
          
          controller.enqueue(encoder.encode(testMessage));
          console.log('[TEST-SSE] Sent test message');
        } catch (error) {
          console.error('[TEST-SSE] Error sending message:', error);
          clearInterval(interval);
        }
      }, 5000);
      
      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[TEST-SSE] Client disconnected');
        clearInterval(interval);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}