"use client";

import { redirect } from "next/navigation";

export default function CameriereLandingPage() {
  // Redirect immediately to nuova-ordinazione as the main page
  redirect("/cameriere/nuova-ordinazione");
}