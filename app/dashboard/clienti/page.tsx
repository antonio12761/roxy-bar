export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { redirect } from "next/navigation";
import ClientiPageWrapper from "./page-wrapper";

export default async function ClientiPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Verifica permessi
  if (!["ADMIN", "MANAGER", "CASSA"].includes(user.ruolo)) {
    redirect("/dashboard");
  }

  return <ClientiPageWrapper />;
}