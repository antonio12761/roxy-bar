import { getCurrentUser, generateToken } from "@/lib/auth-multi-tenant";
import { SSEProvider } from "@/contexts/sse-context";
import CassaPageWrapper from "./page-wrapper-optimized";

export default async function CassaPage() {
  const user = await getCurrentUser();
  
  // Genera un token per l'SSE (questo sarà accessibile solo lato server)
  const token = user ? generateToken(user.id, user.tenantId) : null;
  
  return (
    <SSEProvider token={token || undefined} station="CASSA">
      <CassaPageWrapper />
    </SSEProvider>
  );
}