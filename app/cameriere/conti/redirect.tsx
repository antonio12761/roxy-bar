"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContiRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new unified gestione-conti page
    router.replace("/cameriere/gestione-conti");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">Reindirizzamento in corso...</p>
      </div>
    </div>
  );
}