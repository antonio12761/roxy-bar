import type { Metadata } from 'next';
import { ToastContainer } from '@/lib/toast-notifications';

export const metadata: Metadata = {
  title: 'Roxy Bar - Fidelity Card',
  description: 'La tua carta fedeltà del Bar Roxy sempre con te',
  manifest: '/manifest-fidelity.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roxy Fidelity',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Roxy Bar - Fidelity Card',
    title: 'Roxy Bar - Fidelity Card',
    description: 'La tua carta fedeltà del Bar Roxy sempre con te',
  },
  twitter: {
    card: 'summary',
    title: 'Roxy Bar - Fidelity Card',
    description: 'La tua carta fedeltà del Bar Roxy sempre con te',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      { url: '/fidelity-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: ['/fidelity-icon-192.png'],
    apple: [
      { url: '/fidelity-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function FidelityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js');
              });
            }
            
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
              e.preventDefault();
              deferredPrompt = e;
              window.deferredPrompt = deferredPrompt;
            });
          `,
        }}
      />
      {children}
      <ToastContainer />
    </>
  );
}