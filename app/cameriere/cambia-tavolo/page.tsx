import { getCurrentUser } from "@/lib/auth-multi-tenant";
import CambiaTavoloClient from "./client";

export default async function CambiaTavoloPage() {
  const user = await getCurrentUser();
  
  return <CambiaTavoloClient userId={user?.id} />;
}