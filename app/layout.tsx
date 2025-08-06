import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import '@/lib/setup/decimal-fix';
import '@/lib/utils/log-filter';
import { ThemeProvider } from "@/contexts/ThemeContext";
import ThemeBodyWrapper from "@/components/ThemeBodyWrapper";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Roxy Bar",
  description: "Sistema di gestione per Roxy Bar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Roxy Bar"
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "theme-color": "#000000",
    "msapplication-navbutton-color": "#000000",
    "apple-mobile-web-app-title": "Roxy Bar"
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
  interactiveWidget: "resizes-visual"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={poppins.className}>
        <ThemeProvider>
          <ThemeBodyWrapper>
            {children}
            <Toaster 
              position="top-center" 
              richColors 
              toastOptions={{
                style: {
                  marginTop: 'env(safe-area-inset-top)',
                  maxWidth: '90vw',
                },
                className: 'safe-top',
              }}
            />
          </ThemeBodyWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}