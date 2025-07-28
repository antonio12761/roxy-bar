import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PreparaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  // Se non autenticato, redirect al login
  if (!user) {
    redirect("/login");
  }
  
  // Se l'utente non ha il ruolo giusto, redirect alla home
  if (user.ruolo !== "PREPARA") {
    redirect("/");
  }
  
  return <>{children}</>;
}