export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import DashboardLayoutClient from "./layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Solo ADMIN e MANAGER possono accedere alla dashboard
  if (user.ruolo !== "ADMIN" && user.ruolo !== "MANAGER") {
    redirect("/");
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}