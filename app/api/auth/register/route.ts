import { NextRequest, NextResponse } from "next/server";
import { registerAdmin } from "@/lib/auth-multi-tenant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      tenantName,
      tenantSlug
    } = body;

    // Validazione base
    if (!email || !username || !password || !firstName || !lastName || !tenantName || !tenantSlug) {
      return NextResponse.json(
        { error: "Tutti i campi sono richiesti" },
        { status: 400 }
      );
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Email non valida" },
        { status: 400 }
      );
    }

    // Validazione password
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La password deve essere di almeno 8 caratteri" },
        { status: 400 }
      );
    }

    // Validazione slug
    if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
      return NextResponse.json(
        { error: "Slug non valido (solo lettere minuscole, numeri e trattini)" },
        { status: 400 }
      );
    }

    const result = await registerAdmin({
      email,
      username,
      password,
      firstName,
      lastName,
      tenantName,
      tenantSlug
    });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Register API error:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}