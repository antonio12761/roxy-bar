import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { PermissionService } from "@/lib/services/permission-service";

export async function GET(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const permissions = await PermissionService.getUserPermissions(user.id);

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Errore recupero permessi:", error);
    return NextResponse.json(
      { error: "Errore nel recupero dei permessi" },
      { status: 500 }
    );
  }
}