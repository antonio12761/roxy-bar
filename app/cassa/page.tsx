import { getCurrentUser } from "@/lib/auth";
import { generateToken } from "@/lib/auth";
import { SSEProvider } from "@/contexts/sse-context";
import CassaPageWrapper from "./page-wrapper-optimized";

export default async function CassaPage() {
  const user = await getCurrentUser();
  
  // Genera un token per l'SSE (questo sarà accessibile solo lato server)
  const token = user ? generateToken(user.id) : null;
  
  return (
    <SSEProvider token={token || undefined}>
      <CassaPageWrapper />
    </SSEProvider>
  );
}