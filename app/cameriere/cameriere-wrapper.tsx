import { getCurrentUser, generateToken } from "@/lib/auth-multi-tenant";
import { SSEProvider } from "@/contexts/sse-context";

export default async function CameriereWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  // Genera un token per l'SSE (questo sarà accessibile solo lato server)
  const token = user ? generateToken(user.id, user.tenantId) : null;
  
  return (
    <SSEProvider token={token || undefined}>
      {children}
    </SSEProvider>
  );
}