import CameriereWrapper from "./cameriere-wrapper";
import CameriereLayoutClient from "./layout-client";
import { getCurrentUser } from "@/lib/auth-multi-tenant";

export default async function CameriereLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  return (
    <CameriereWrapper>
      <CameriereLayoutClient user={user}>{children}</CameriereLayoutClient>
    </CameriereWrapper>
  );
}