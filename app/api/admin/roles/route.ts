import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAuth } from "@/lib/auth";
import { PermissionService } from "@/lib/services/permission-service";
import { nanoid } from "nanoid";

// GET /api/admin/roles - Ottieni tutti i ruoli
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

    const roles = await prisma.customRole.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      include: {
        RolePermission: {
          include: {
            Permission: true
          }
        },
        UserCustomRole: {
          include: {
            User: {
              select: {
                id: true,
                nome: true,
                cognome: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            UserCustomRole: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Errore GET ruoli:", error);
    return NextResponse.json(
      { error: "Errore nel recupero dei ruoli" },
      { status: 500 }
    );
  }
}

// POST /api/admin/roles - Crea un nuovo ruolo
export async function POST(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.create'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: "Nome ruolo richiesto" }, { status: 400 });
    }

    // Crea il ruolo
    const role = await prisma.customRole.create({
      data: {
        id: nanoid(),
        name,
        description,
        tenantId: user.tenantId!,
        updatedAt: new Date()
      }
    });

    // Assegna i permessi al ruolo
    if (permissions && Array.isArray(permissions)) {
      for (const permissionId of permissions) {
        await prisma.rolePermission.create({
          data: {
            id: nanoid(),
            roleId: role.id,
            permissionId
          }
        });
      }
    }

    // Recupera il ruolo con i permessi
    const roleWithPermissions = await prisma.customRole.findUnique({
      where: { id: role.id },
      include: {
        RolePermission: {
          include: {
            Permission: true
          }
        }
      }
    });

    return NextResponse.json({ role: roleWithPermissions });
  } catch (error) {
    console.error("Errore POST ruolo:", error);
    return NextResponse.json(
      { error: "Errore nella creazione del ruolo" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/roles - Aggiorna un ruolo
export async function PUT(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.edit'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, permissions, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "ID ruolo richiesto" }, { status: 400 });
    }

    // Verifica che il ruolo appartenga al tenant
    const existingRole = await prisma.customRole.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Ruolo non trovato" }, { status: 404 });
    }

    // Non permettere la modifica di ruoli di sistema
    if (existingRole.isSystem) {
      return NextResponse.json({ error: "Non è possibile modificare ruoli di sistema" }, { status: 403 });
    }

    // Aggiorna il ruolo
    const updatedRole = await prisma.customRole.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
        updatedAt: new Date()
      }
    });

    // Aggiorna i permessi se forniti
    if (permissions !== undefined) {
      // Rimuovi tutti i permessi esistenti
      await prisma.rolePermission.deleteMany({
        where: { roleId: id }
      });

      // Aggiungi i nuovi permessi
      if (Array.isArray(permissions)) {
        for (const permissionId of permissions) {
          await prisma.rolePermission.create({
            data: {
              id: nanoid(),
              roleId: id,
              permissionId
            }
          });
        }
      }
    }

    // Recupera il ruolo aggiornato con i permessi
    const roleWithPermissions = await prisma.customRole.findUnique({
      where: { id },
      include: {
        RolePermission: {
          include: {
            Permission: true
          }
        }
      }
    });

    return NextResponse.json({ role: roleWithPermissions });
  } catch (error) {
    console.error("Errore PUT ruolo:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del ruolo" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/roles - Elimina un ruolo
export async function DELETE(request: NextRequest) {
  try {
    const user = await checkAuth();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica permesso
    const hasPermission = await PermissionService.hasPermission({
      userId: user.id,
      permission: 'roles.delete'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "ID ruolo richiesto" }, { status: 400 });
    }

    // Verifica che il ruolo appartenga al tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!role) {
      return NextResponse.json({ error: "Ruolo non trovato" }, { status: 404 });
    }

    // Non permettere l'eliminazione di ruoli di sistema
    if (role.isSystem) {
      return NextResponse.json({ error: "Non è possibile eliminare ruoli di sistema" }, { status: 403 });
    }

    // Elimina il ruolo (le relazioni vengono eliminate automaticamente con CASCADE)
    await prisma.customRole.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE ruolo:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione del ruolo" },
      { status: 500 }
    );
  }
}