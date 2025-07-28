import { useEffect, useRef, useCallback } from 'react'

type SSEEventHandler = (data: any) => void

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null)
  const listenersRef = useRef<Map<string, SSEEventHandler[]>>(new Map())

  const subscribe = useCallback((eventType: string, handler: SSEEventHandler) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, [])
    }
    listenersRef.current.get(eventType)!.push(handler)

    // Return unsubscribe function
    return () => {
      const handlers = listenersRef.current.get(eventType)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }, [])

  useEffect(() => {
    // Initialize SSE connection
    if (typeof window !== 'undefined') {
      eventSourceRef.current = new EventSource('/api/sse')
      
      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const handlers = listenersRef.current.get(data.type) || []
          handlers.forEach(handler => handler(data))
        } catch (error) {
          console.error('Error parsing SSE message:', error)
        }
      }

      eventSourceRef.current.onerror = (error) => {
        console.error('SSE connection error:', error)
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return { subscribe }
}