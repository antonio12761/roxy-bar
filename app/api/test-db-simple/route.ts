import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log("Test DB connection...");
    
    // Test più semplice possibile
    const count = await prisma.tavolo.count();
    console.log("Tavoli count:", count);
    
    return NextResponse.json({
      success: true,
      tavoliCount: count
    });
  } catch (error: any) {
    console.error("Errore dettagliato:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error",
      code: error.code,
      meta: error.meta,
      stack: error.stack
    }, { status: 500 });
  }
}