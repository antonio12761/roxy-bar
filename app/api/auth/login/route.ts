import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth-multi-tenant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, tenantSlug } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username e password richiesti" },
        { status: 400 }
      );
    }

    const result = await loginUser(username, password);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}