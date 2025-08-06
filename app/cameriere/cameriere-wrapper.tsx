import { getCurrentUser, generateToken } from "@/lib/auth-multi-tenant";
import { SSEProvider } from "@/contexts/sse-context";
import { prisma } from "@/lib/db";
import OutOfStockNotificationProvider from "@/components/cameriere/OutOfStockNotificationProvider";

export default async function CameriereWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  // Genera un token per l'SSE (questo sarà accessibile solo lato server)
  const token = user ? generateToken(user.id, user.tenantId) : null;
  
  // Get available products for substitution
  const availableProducts = user ? await prisma.prodotto.findMany({
    where: {
      disponibile: true,
      terminato: false
    },
    select: {
      id: true,
      nome: true,
      prezzo: true,
      categoria: true
    },
    orderBy: {
      nome: 'asc'
    }
  }) : [];
  
  // Convert Decimal to number for serialization
  const serializedProducts = availableProducts.map(p => ({
    ...p,
    prezzo: p.prezzo.toNumber()
  }));
  
  return (
    <SSEProvider token={token || undefined} station="CAMERIERE">
      {user ? (
        <OutOfStockNotificationProvider 
          currentUserId={user.id}
          availableProducts={serializedProducts}
        >
          {children}
        </OutOfStockNotificationProvider>
      ) : (
        children
      )}
    </SSEProvider>
  );
}