export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth-multi-tenant";
import PreparaPageOptimized from "./page-wrapper-optimized";

export default async function PreparaPage() {
  const user = await getCurrentUser();
  
  // Prepara dati utente serializzabili
  const serializedUser = user ? {
    id: user.id,
    nome: user.nome,
    cognome: user.cognome,
    ruolo: user.ruolo
  } : null;
  
  return <PreparaPageOptimized currentUser={serializedUser} />;
}