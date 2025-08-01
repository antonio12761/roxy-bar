import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { PermissionService } from "@/lib/services/permission-service";

export async function GET(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const permission = searchParams.get('permission');

    if (!permission) {
      return NextResponse.json({ error: "Permesso non specificato" }, { status: 400 });
    }

    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission,
      tenantId: user.tenantId
    });

    return NextResponse.json({ hasPermission });
  } catch (error) {
    console.error("Errore verifica permesso:", error);
    return NextResponse.json(
      { error: "Errore nel controllo del permesso" },
      { status: 500 }
    );
  }
}