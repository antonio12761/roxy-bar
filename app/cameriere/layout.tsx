import CameriereWrapper from "./cameriere-wrapper";
import CameriereLayoutClient from "./layout-client";

export default async function CameriereLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CameriereWrapper>
      <CameriereLayoutClient>{children}</CameriereLayoutClient>
    </CameriereWrapper>
  );
}