import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // IMPORTANTE: Rimuovi questo endpoint dopo il debug!
  
  const envVars = {
    hasDatabase: !!process.env.DATABASE_URL,
    databaseUrlLength: process.env.DATABASE_URL?.length || 0,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) || "NOT SET",
    hasJwtSecret: !!process.env.JWT_SECRET,
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
    nodeEnv: process.env.NODE_ENV || "NOT SET",
    cookieName: process.env.SESSION_COOKIE_NAME || "NOT SET",
    vercelEnv: process.env.VERCEL_ENV || "NOT SET"
  };

  return NextResponse.json({
    message: "Environment check",
    vars: envVars,
    warning: "Remove this endpoint after debugging!"
  });
}