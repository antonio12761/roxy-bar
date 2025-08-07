'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
}

export function ModalPortal({ children, isOpen }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Fix per Android PWA - assicura che il body non sia scrollabile quando modal è aperto
    if (isOpen) {
      const originalStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        width: document.body.style.width
      };
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = originalStyle.overflow;
        document.body.style.position = originalStyle.position;
        document.body.style.width = originalStyle.width;
      };
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  // Crea o trova il container per i modal
  let modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    modalRoot.style.position = 'fixed';
    modalRoot.style.top = '0';
    modalRoot.style.left = '0';
    modalRoot.style.right = '0';
    modalRoot.style.bottom = '0';
    modalRoot.style.zIndex = '9999';
    modalRoot.style.pointerEvents = 'none';
    document.body.appendChild(modalRoot);
  }

  return createPortal(
    <div style={{ pointerEvents: 'auto' }}>
      {children}
    </div>,
    modalRoot
  );
}