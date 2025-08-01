import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cucina - Siplit',
  description: 'Postazione cucina per preparazione ordini',
}

export default function CucinaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}