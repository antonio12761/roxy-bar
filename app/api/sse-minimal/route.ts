export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  
  const customReadable = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
      
      // Send heartbeat every 5 seconds
      const interval = setInterval(() => {
        controller.enqueue(
          encoder.encode(`data: {"type":"heartbeat","time":"${new Date().toISOString()}"}\n\n`)
        );
      }, 5000);
      
      // Cleanup
      const cleanup = () => {
        clearInterval(interval);
        controller.close();
      };
      
      // Handle client disconnect
      // In production, you'd want to handle this differently
      setTimeout(cleanup, 60000); // Auto-close after 1 minute for testing
    },
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}