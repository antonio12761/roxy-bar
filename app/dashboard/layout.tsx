import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}