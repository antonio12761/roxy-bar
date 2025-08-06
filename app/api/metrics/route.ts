import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-multi-tenant';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tokenData = verifyToken(token);
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Check if user is supervisor/admin
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: { ruolo: true, tenantId: true }
    });
    
    if (!user || user.ruolo !== 'SUPERVISORE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Return basic metrics placeholder
    return NextResponse.json({
      status: 'ok',
      tenantId: user.tenantId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}