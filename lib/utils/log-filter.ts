// Filtra i log SSE in development
if (process.env.NODE_ENV === 'development') {
  const originalLog = console.log;
  const originalInfo = console.info;
  
  console.log = (...args: any[]) => {
    // Filtra i log delle richieste SSE
    const message = args.join(' ');
    if (message.includes('GET /api/sse') || 
        message.includes('POST /api/sse') ||
        message.includes('/api/sse?token=')) {
      return;
    }
    originalLog(...args);
  };
  
  console.info = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('GET /api/sse') || 
        message.includes('POST /api/sse') ||
        message.includes('/api/sse?token=')) {
      return;
    }
    originalInfo(...args);
  };
}