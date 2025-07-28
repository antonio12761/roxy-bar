// Simple toast implementation without external dependencies

export interface ToastOptions {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

let toastContainer: HTMLElement | null = null;
let toastId = 0;

const createToastContainer = () => {
  if (toastContainer) return toastContainer;
  
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    pointer-events: none;
    max-width: 400px;
  `;
  document.body.appendChild(toastContainer);
  return toastContainer;
};

const createToastElement = (message: string, options: ToastOptions = {}) => {
  const { type = 'info', duration = 4000 } = options;
  
  const toast = document.createElement('div');
  const id = `toast-${++toastId}`;
  toast.id = id;
  
  const colors = {
    success: { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.2)' },
    error: { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.15)' },
    warning: { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.18)' },
    info: { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.18)' }
  };
  
  const color = colors[type];
  
  toast.style.cssText = `
    background: ${color.bg};
    backdrop-filter: blur(10px);
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    margin-bottom: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    border: 1px solid ${color.border};
    border-left: 4px solid ${color.border};
    pointer-events: auto;
    transform: translateX(100%);
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    max-width: 100%;
    word-wrap: break-word;
  `;
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px; opacity: ${type === 'success' ? '0.7' : type === 'error' ? '0.4' : '0.5'};">
        ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
      </span>
      <span style="opacity: ${type === 'success' ? '0.9' : type === 'error' ? '0.7' : '0.8'};">${message}</span>
    </div>
  `;
  
  // Add click to dismiss
  toast.addEventListener('click', () => {
    removeToast(id);
  });
  
  return { toast, id, duration };
};

const removeToast = (id: string) => {
  const toast = document.getElementById(id);
  if (toast) {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }
};

export const toast = {
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    return showToast(message, { ...options, type: 'success' });
  },
  
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    return showToast(message, { ...options, type: 'error' });
  },
  
  warning: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    return showToast(message, { ...options, type: 'warning' });
  },
  
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    return showToast(message, { ...options, type: 'info' });
  }
};

const showToast = (message: string, options: ToastOptions = {}) => {
  const container = createToastContainer();
  const { toast: toastElement, id, duration } = createToastElement(message, options);
  
  container.appendChild(toastElement);
  
  // Trigger animation
  setTimeout(() => {
    toastElement.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto remove
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
  
  return id;
};