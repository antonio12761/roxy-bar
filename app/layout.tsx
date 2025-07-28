import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import '@/lib/setup/decimal-fix';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bar Roxy - Sistema di Gestione",
  description: "Sistema di gestione per Bar Roxy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <body className={`${inter.className} dark bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}