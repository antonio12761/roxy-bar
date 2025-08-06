"use client";

import { create } from 'zustand';
import { CheckCircle, XCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
}

// Store Zustand per gestione stato toast
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = crypto.randomUUID();
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? (toast.type === 'loading' ? 0 : 4000)
    };
    
    set((state) => ({
      toasts: [...state.toasts, newToast]
    }));
    
    // Auto-remove dopo duration (se non è loading)
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter(t => t.id !== id)
        }));
      }, newToast.duration);
    }
    
    return id;
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },
  
  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map(t => 
        t.id === id ? { ...t, ...updates } : t
      )
    }));
  },
  
  clearAll: () => {
    set({ toasts: [] });
  }
}));

// Hook per utilizzo semplificato
export function useToast() {
  const { addToast, removeToast, updateToast } = useToastStore();
  
  return {
    success: (title: string, message?: string, duration?: number) => {
      return addToast({ type: 'success', title, message, duration });
    },
    
    error: (title: string, message?: string, duration?: number) => {
      return addToast({ type: 'error', title, message, duration: duration ?? 6000 });
    },
    
    warning: (title: string, message?: string, duration?: number) => {
      return addToast({ type: 'warning', title, message, duration });
    },
    
    info: (title: string, message?: string, duration?: number) => {
      return addToast({ type: 'info', title, message, duration });
    },
    
    loading: (title: string, message?: string) => {
      return addToast({ type: 'loading', title, message, duration: 0 });
    },
    
    promise: async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ): Promise<T> => {
      const id = addToast({ type: 'loading', title: messages.loading });
      
      try {
        const result = await promise;
        const successMsg = typeof messages.success === 'function' 
          ? messages.success(result) 
          : messages.success;
        updateToast(id, { type: 'success', title: successMsg, duration: 4000 });
        
        setTimeout(() => removeToast(id), 4000);
        return result;
      } catch (error) {
        const errorMsg = typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error;
        updateToast(id, { type: 'error', title: errorMsg, duration: 6000 });
        
        setTimeout(() => removeToast(id), 6000);
        throw error;
      }
    },
    
    dismiss: removeToast,
    dismissAll: useToastStore.getState().clearAll
  };
}

// Component per renderizzare i toast
export function ToastContainer() {
  const toasts = useToastStore(state => state.toasts);
  const removeToast = useToastStore(state => state.removeToast);
  
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            min-w-[300px] rounded-lg shadow-lg p-4 flex items-start gap-3
            animate-in slide-in-from-bottom-2 fade-in duration-200
            ${getToastStyles(toast.type)}
          `}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getToastIcon(toast.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {toast.title}
            </p>
            {toast.message && (
              <p className="mt-1 text-sm opacity-90">
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="mt-2 text-sm font-medium underline hover:no-underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          
          {toast.type !== 'loading' && (
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function getToastStyles(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'bg-green-600 text-white';
    case 'error':
      return 'bg-red-600 text-white';
    case 'warning':
      return 'bg-amber-600 text-white';
    case 'info':
      return 'bg-blue-600 text-white';
    case 'loading':
      return 'bg-gray-700 text-white';
    default:
      return 'bg-gray-700 text-white';
  }
}

function getToastIcon(type: ToastType) {
  const className = "w-5 h-5";
  
  switch (type) {
    case 'success':
      return <CheckCircle className={className} />;
    case 'error':
      return <XCircle className={className} />;
    case 'warning':
      return <AlertCircle className={className} />;
    case 'info':
      return <Info className={className} />;
    case 'loading':
      return <Loader2 className={`${className} animate-spin`} />;
    default:
      return <Info className={className} />;
  }
}

// Singleton per uso globale (opzionale)
let toastInstance: ReturnType<typeof useToast> | null = null;

export function getToast() {
  if (!toastInstance) {
    toastInstance = {
      success: (title: string, message?: string) => 
        useToastStore.getState().addToast({ type: 'success', title, message }),
      error: (title: string, message?: string) => 
        useToastStore.getState().addToast({ type: 'error', title, message, duration: 6000 }),
      warning: (title: string, message?: string) => 
        useToastStore.getState().addToast({ type: 'warning', title, message }),
      info: (title: string, message?: string) => 
        useToastStore.getState().addToast({ type: 'info', title, message }),
      loading: (title: string, message?: string) => 
        useToastStore.getState().addToast({ type: 'loading', title, message, duration: 0 }),
      dismiss: useToastStore.getState().removeToast,
      dismissAll: useToastStore.getState().clearAll,
      promise: async (promise: any, messages: any) => {
        const id = useToastStore.getState().addToast({ 
          type: 'loading', 
          title: messages.loading 
        });
        
        try {
          const result = await promise;
          const successMsg = typeof messages.success === 'function' 
            ? messages.success(result) 
            : messages.success;
          useToastStore.getState().updateToast(id, { 
            type: 'success', 
            title: successMsg, 
            duration: 4000 
          });
          
          setTimeout(() => useToastStore.getState().removeToast(id), 4000);
          return result;
        } catch (error) {
          const errorMsg = typeof messages.error === 'function'
            ? messages.error(error)
            : messages.error;
          useToastStore.getState().updateToast(id, { 
            type: 'error', 
            title: errorMsg, 
            duration: 6000 
          });
          
          setTimeout(() => useToastStore.getState().removeToast(id), 6000);
          throw error;
        }
      }
    };
  }
  
  return toastInstance;
}