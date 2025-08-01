"use server";

import { loginUser, logout as logoutUser, getCurrentUser } from "@/lib/auth-multi-tenant";
import type { LoginResult as AuthResult, AuthUser as User } from "@/lib/auth-multi-tenant";
import { revalidatePath } from "next/cache";

// Re-export getCurrentUser
export { getCurrentUser };

// Helper per determinare il redirect dopo login
function getRedirectPath(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/dashboard";
    case "MANAGER":
      return "/dashboard";
    case "SUPERVISORE":
      return "/supervisore";
    case "CAMERIERE":
      return "/cameriere";
    case "PREPARA":
      return "/prepara";
    case "BANCO":
      return "/banco";
    case "CUCINA":
      return "/cucina";
    case "CASSA":
      return "/cassa";
    default:
      return "/menu";
  }
}

// Login action con username e password
export async function login(username: string, password: string): Promise<AuthResult> {
  try {
    const result = await loginUser(username, password);

    if (result.success && result.user) {
      // Redirect basato sul ruolo
      const redirectPath = getRedirectPath(result.user.ruolo);
      
      // Revalidate paths
      revalidatePath("/login");
      revalidatePath(redirectPath);
      revalidatePath("/");

      // Aggiungi il path di redirect al risultato
      return { ...result, redirectPath };
    }

    return result;
  } catch (error) {
    console.error("Errore login action:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Logout action
export async function logout() {
  try {
    const result = await logoutUser();

    if (result.success) {
      revalidatePath("/");
      return { success: true };
    } else {
      return { success: false, error: "Errore durante il logout" };
    }
  } catch (error) {
    console.error("Errore logout:", error);
    return { success: false, error: "Errore interno del server" };
  }
}

// Ottieni utente corrente action
export async function getUser(): Promise<User | null> {
  return await getCurrentUser();
}