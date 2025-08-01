export const dynamic = "force-dynamic";

import { getOrdinazioniPerStato } from '@/lib/actions/ordinazioni'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { PageWrapper } from './page-wrapper'

export default async function GestioneOrdiniPage() {
  const utente = await getCurrentUser()
  
  if (!utente) {
    redirect('/login')
  }

  const ordinazioni = await getOrdinazioniPerStato()

  return <PageWrapper initialOrdinazioni={ordinazioni as any} />
}