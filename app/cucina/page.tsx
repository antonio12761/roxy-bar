import { getCurrentUser } from "@/lib/auth-multi-tenant"
import { redirect } from 'next/navigation'
import CucinaPageWrapper from './page-wrapper-optimized'

export default async function CucinaPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  // Verifica che l'utente abbia i permessi per accedere alla cucina
  const allowedRoles = ['ADMIN', 'MANAGER', 'SUPERVISORE', 'CUCINA']
  if (!allowedRoles.includes(user.ruolo)) {
    redirect('/')
  }

  return <CucinaPageWrapper />
}