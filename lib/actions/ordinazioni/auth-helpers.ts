"use server";

import { getCurrentUser } from "@/lib/auth-multi-tenant";

export async function getAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Utente non autenticato");
  }
  return user;
}

export async function checkUserPermission(roles: string[]) {
  const user = await getAuthenticatedUser();
  if (!roles.includes(user.ruolo)) {
    throw new Error("Permessi insufficienti");
  }
  return user;
}