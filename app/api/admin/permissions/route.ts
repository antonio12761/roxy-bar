import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAuth } from "@/lib/auth";
import { PermissionService } from "@/lib/services/permission-service";

// GET /api/admin/permissions - Ottieni tutti i permessi
export async function GET(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.view'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const permissions = await prisma.permission.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' }
      ]
    });

    // Raggruppa i permessi per risorsa
    const groupedPermissions = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return NextResponse.json({ 
      permissions,
      groupedPermissions 
    });
  } catch (error) {
    console.error("Errore GET permessi:", error);
    return NextResponse.json(
      { error: "Errore nel recupero dei permessi" },
      { status: 500 }
    );
  }
}

// GET /api/admin/permissions/user/:userId - Ottieni i permessi di un utente
export async function GET_USER_PERMISSIONS(request: NextRequest, userId: string) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'users.view'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
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

    // Ottieni tutti i permessi dell'utente
    const permissions = await PermissionService.getUserPermissions(userId);

    // Ottieni i ruoli personalizzati dell'utente
    const customRoles = await prisma.userCustomRole.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        CustomRole: {
          include: {
            RolePermission: {
              include: {
                Permission: true
              }
            }
          }
        },
        User_assignedBy: {
          select: {
            id: true,
            nome: true,
            cognome: true
          }
        }
      }
    });

    // Ottieni i permessi diretti dell'utente
    const directPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        Permission: true,
        User_grantedBy: {
          select: {
            id: true,
            nome: true,
            cognome: true
          }
        }
      }
    });

    return NextResponse.json({
      permissions,
      customRoles,
      directPermissions,
      systemRole: targetUser.ruolo
    });
  } catch (error) {
    console.error("Errore GET permessi utente:", error);
    return NextResponse.json(
      { error: "Errore nel recupero dei permessi utente" },
      { status: 500 }
    );
  }
}