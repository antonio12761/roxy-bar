import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAuth } from "@/lib/auth";
import { PermissionService } from "@/lib/services/permission-service";
import { nanoid } from "nanoid";

// POST /api/admin/users/roles - Assegna un ruolo a un utente
export async function POST(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.assign'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const body = await request.json();
    const { userId: targetUserId, roleId, expiresAt } = body;

    if (!targetUserId || !roleId) {
      return NextResponse.json({ error: "userId e roleId richiesti" }, { status: 400 });
    }

    // Verifica che l'utente target appartenga allo stesso tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId: user.tenantId
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Verifica che il ruolo appartenga allo stesso tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        tenantId: user.tenantId,
        isActive: true
      }
    });

    if (!role) {
      return NextResponse.json({ error: "Ruolo non trovato" }, { status: 404 });
    }

    // Assegna il ruolo
    await PermissionService.assignCustomRole(
      targetUserId,
      roleId,
      user.id,
      expiresAt ? new Date(expiresAt) : undefined
    );

    return NextResponse.json({ 
      success: true,
      message: `Ruolo ${role.name} assegnato a ${targetUser.nome} ${targetUser.cognome}`
    });
  } catch (error) {
    console.error("Errore assegnazione ruolo:", error);
    return NextResponse.json(
      { error: "Errore nell'assegnazione del ruolo" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/roles - Rimuovi un ruolo da un utente
export async function DELETE(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.assign'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const roleId = searchParams.get('roleId');

    if (!userId || !roleId) {
      return NextResponse.json({ error: "userId e roleId richiesti" }, { status: 400 });
    }

    // Verifica che l'utente appartenga allo stesso tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Rimuovi il ruolo
    await PermissionService.removeCustomRole(userId, roleId);

    return NextResponse.json({ 
      success: true,
      message: "Ruolo rimosso con successo"
    });
  } catch (error) {
    console.error("Errore rimozione ruolo:", error);
    return NextResponse.json(
      { error: "Errore nella rimozione del ruolo" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users/permissions - Assegna/nega un permesso diretto a un utente
export async function POST_PERMISSION(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Solo admin può assegnare permessi diretti
    if (user.ruolo !== 'ADMIN') {
      return NextResponse.json({ error: "Solo gli admin possono assegnare permessi diretti" }, { status: 403 });
    }

    const body = await request.json();
    const { userId: targetUserId, permissionId, granted, reason, expiresAt } = body;

    if (!targetUserId || !permissionId || granted === undefined) {
      return NextResponse.json({ error: "userId, permissionId e granted richiesti" }, { status: 400 });
    }

    // Verifica che l'utente appartenga allo stesso tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId: user.tenantId
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Verifica che il permesso esista
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId }
    });

    if (!permission) {
      return NextResponse.json({ error: "Permesso non trovato" }, { status: 404 });
    }

    // Assegna o nega il permesso
    await PermissionService.setUserPermission(
      targetUserId,
      permissionId,
      granted,
      user.id,
      reason,
      expiresAt ? new Date(expiresAt) : undefined
    );

    return NextResponse.json({ 
      success: true,
      message: `Permesso ${permission.name} ${granted ? 'concesso' : 'negato'} a ${targetUser.nome} ${targetUser.cognome}`
    });
  } catch (error) {
    console.error("Errore assegnazione permesso:", error);
    return NextResponse.json(
      { error: "Errore nell'assegnazione del permesso" },
      { status: 500 }
    );
  }
}