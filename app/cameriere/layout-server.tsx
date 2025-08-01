import CameriereWrapper from "./cameriere-wrapper";

export default function CameriereLayoutServer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CameriereWrapper>{children}</CameriereWrapper>;
}