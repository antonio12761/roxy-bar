import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, hashPassword, hasPermission } from "@/lib/auth-multi-tenant";

// GET - Lista utenti del tenant
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth('manage_users');
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantId: user.tenantId
    };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
        { cognome: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.ruolo = role;
    }

    if (status === 'active') {
      where.attivo = true;
      where.bloccato = false;
    } else if (status === 'blocked') {
      where.bloccato = true;
    } else if (status === 'inactive') {
      where.attivo = false;
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          nome: true,
          cognome: true,
          ruolo: true,
          attivo: true,
          bloccato: true,
          emailVerified: true,
          ultimoAccesso: true,
          createdAt: true,
          failedLoginAttempts: true,
          lockedUntil: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli utenti' },
      { status: 500 }
    );
  }
}

// POST - Crea nuovo utente
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth('manage_users');
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const {
      username,
      email,
      password,
      nome,
      cognome,
      ruolo,
      mustChangePassword = true
    } = body;

    // Validazione
    if (!username || !email || !password || !nome || !cognome || !ruolo) {
      const missingFields = [];
      if (!username) missingFields.push('username');
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      if (!nome) missingFields.push('nome');
      if (!cognome) missingFields.push('cognome');
      if (!ruolo) missingFields.push('ruolo');
      
      return NextResponse.json(
        { error: `Campi mancanti: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato email non valido' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La password deve essere almeno 6 caratteri' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'SUPERVISORE', 'CAMERIERE', 'PREPARA', 'BANCO', 'CUCINA', 'CASSA'];
    if (!validRoles.includes(ruolo)) {
      return NextResponse.json(
        { error: `Ruolo non valido. Ruoli validi: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check username unique
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username già in uso' },
        { status: 400 }
      );
    }

    // Check email unique per tenant
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        tenantId: user.tenantId
      }
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email già registrata in questa organizzazione' },
        { status: 400 }
      );
    }

    // Check tenant limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        _count: {
          select: { User: true }
        }
      }
    });

    if (tenant && tenant._count.User >= tenant.maxUsers) {
      return NextResponse.json(
        { error: `Limite utenti raggiunto (${tenant.maxUsers})` },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username,
        email,
        password: hashedPassword,
        nome,
        cognome,
        ruolo,
        tenantId: user.tenantId,
        mustChangePassword,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true,
        createdAt: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        action: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        newValues: newUser
      }
    });

    return NextResponse.json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    // Check for specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Username o email già esistenti' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('Invalid `prisma.user.create()`')) {
        console.error('Prisma validation error:', error.message);
        return NextResponse.json(
          { error: 'Errore di validazione dati. Controlla i campi inseriti.' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Errore nella creazione dell\'utente' },
      { status: 500 }
    );
  }
}

// PATCH - Aggiorna utente
export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await requireAuth('manage_users');
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const body = await request.json();
    const { userId, ...updateData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'ID utente richiesto' },
        { status: 400 }
      );
    }

    // Get existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Prevent modifying super admin unless you are super admin
    if (existingUser.ruolo === 'ADMIN' && user.ruolo !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non puoi modificare un super admin' },
        { status: 403 }
      );
    }

    // If updating username, check uniqueness
    if (updateData.username && updateData.username !== existingUser.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: updateData.username }
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: 'Username già in uso' },
          { status: 400 }
        );
      }
    }

    // If updating password, hash it
    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
      updateData.passwordChangedAt = new Date();
      updateData.mustChangePassword = false;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true,
        bloccato: true,
        ultimoAccesso: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        oldValues: existingUser,
        newValues: updatedUser
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'utente' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina utente
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth('manage_users');
    
    if (!user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'ID utente richiesto' },
        { status: 400 }
      );
    }

    // Check user exists in tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Prevent deleting yourself
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Non puoi eliminare il tuo account' },
        { status: 400 }
      );
    }

    // Prevent deleting super admin
    if (existingUser.ruolo === 'ADMIN') {
      return NextResponse.json(
        { error: 'Non puoi eliminare un super admin' },
        { status: 403 }
      );
    }

    // Soft delete (set inactive)
    await prisma.user.update({
      where: { id: userId },
      data: { attivo: false }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        action: 'DELETE',
        entityType: 'USER',
        entityId: userId,
        oldValues: existingUser,
        tenantId: user.tenantId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Utente disattivato con successo'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dell\'utente' },
      { status: 500 }
    );
  }
}