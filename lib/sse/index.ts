// Export main SSE functions
export { 
  sseService, 
  emitOrderNew, 
  emitOrderUpdate, 
  emitOrderReady, 
  emitNotification,
  emitSSE
} from './sse-service';

export { sseManager } from './sse-manager';
export * from './sse-events';