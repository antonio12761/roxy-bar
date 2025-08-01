import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Log per debug
    console.log("=== DEBUG AUTH ===");
    console.log("Username ricevuto:", username);
    console.log("JWT_SECRET presente:", !!process.env.JWT_SECRET);
    console.log("JWT_SECRET length:", process.env.JWT_SECRET?.length);
    console.log("DATABASE_URL presente:", !!process.env.DATABASE_URL);
    console.log("NODE_ENV:", process.env.NODE_ENV);

    // Prova a trovare l'utente
    const user = await prisma.user.findFirst({
      where: {
        username: username
      },
      select: {
        id: true,
        username: true,
        password: true,
        attivo: true,
        lockedUntil: true,
        failedLoginAttempts: true,
        tenantId: true
      }
    });

    console.log("Utente trovato:", !!user);
    if (user) {
      console.log("User ID:", user.id);
      console.log("User attivo:", user.attivo);
      console.log("User locked:", !!user.lockedUntil);
      console.log("Failed attempts:", user.failedLoginAttempts);
    }

    // Verifica password
    if (user && password) {
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log("Password match:", passwordMatch);
    }

    // Conta totale utenti
    const totalUsers = await prisma.user.count();
    console.log("Totale utenti nel DB:", totalUsers);

    return NextResponse.json({
      debug: {
        userFound: !!user,
        totalUsers,
        nodeEnv: process.env.NODE_ENV,
        hasJwtSecret: !!process.env.JWT_SECRET,
        jwtSecretLength: process.env.JWT_SECRET?.length || 0,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      }
    });

  } catch (error) {
    console.error("Debug auth error:", error);
    return NextResponse.json({
      error: "Debug error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}