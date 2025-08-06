import { redirect } from 'next/navigation'

export default function OrdinePage() {
  // Redirect to login with a special parameter
  redirect('/login?access=ordine')
}