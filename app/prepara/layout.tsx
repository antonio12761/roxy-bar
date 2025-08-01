import PreparaWrapper from "./prepara-wrapper";
import PreparaLayoutClient from "./layout-client";

export default async function PreparaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PreparaWrapper>
      <PreparaLayoutClient>{children}</PreparaLayoutClient>
    </PreparaWrapper>
  );
}