"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CameriereLandingPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect immediately to nuova-ordinazione as the main page
    router.replace("/cameriere/nuova-ordinazione");
  }, [router]);
  
  return null; // o un loading spinner se preferisci
}