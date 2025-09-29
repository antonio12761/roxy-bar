"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-multi-tenant";
import { secureLog } from "@/lib/utils/log-sanitizer";

export interface MetricsData {
  status: string;
  tenantId: string;
  timestamp: string;
  orders?: {
    today: number;
    week: number;
    month: number;
  };
  revenue?: {
    today: number;
    week: number;
    month: number;
  };
  products?: {
    topSelling: Array<{
      id: number;
      nome: string;
      quantita: number;
    }>;
    outOfStock: number;
  };
}

/**
 * Recupera le metriche del sistema
 */
export async function getSystemMetrics() {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Get tenant ID from user
    const tenantId = user.tenantId || 'default';

    // Return basic metrics placeholder for now
    const metrics: MetricsData = {
      status: 'ok',
      tenantId,
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      data: metrics
    };
  } catch (error) {
    secureLog.error('Error fetching metrics:', error);
    return { 
      success: false, 
      error: 'Errore recupero metriche' 
    };
  }
}

/**
 * Recupera metriche dettagliate degli ordini
 */
export async function getOrderMetrics(dateRange?: { from: Date; to: Date }) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Calculate date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    // Get orders count for different periods
    const [todayOrders, weekOrders, monthOrders] = await Promise.all([
      prisma.ordinazione.count({
        where: {
          createdAt: { gte: today },
          stato: { not: 'ANNULLATO' }
        }
      }),
      prisma.ordinazione.count({
        where: {
          createdAt: { gte: weekAgo },
          stato: { not: 'ANNULLATO' }
        }
      }),
      prisma.ordinazione.count({
        where: {
          createdAt: { gte: monthAgo },
          stato: { not: 'ANNULLATO' }
        }
      })
    ]);

    // Get revenue for different periods
    const [todayRevenue, weekRevenue, monthRevenue] = await Promise.all([
      prisma.ordinazione.aggregate({
        _sum: { totale: true },
        where: {
          createdAt: { gte: today },
          stato: 'PAGATO'
        }
      }),
      prisma.ordinazione.aggregate({
        _sum: { totale: true },
        where: {
          createdAt: { gte: weekAgo },
          stato: 'PAGATO'
        }
      }),
      prisma.ordinazione.aggregate({
        _sum: { totale: true },
        where: {
          createdAt: { gte: monthAgo },
          stato: 'PAGATO'
        }
      })
    ]);

    return {
      success: true,
      data: {
        orders: {
          today: todayOrders,
          week: weekOrders,
          month: monthOrders
        },
        revenue: {
          today: todayRevenue._sum.totale || 0,
          week: weekRevenue._sum.totale || 0,
          month: monthRevenue._sum.totale || 0
        }
      }
    };
  } catch (error) {
    secureLog.error('Error fetching order metrics:', error);
    return { 
      success: false, 
      error: 'Errore recupero metriche ordini' 
    };
  }
}

/**
 * Recupera metriche sui prodotti
 */
export async function getProductMetrics() {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN", "MANAGER", "CASSA"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Get top selling products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topProducts = await prisma.rigaOrdinazione.groupBy({
      by: ['prodottoId'],
      _sum: {
        quantita: true
      },
      where: {
        Ordinazione: {
          createdAt: { gte: thirtyDaysAgo },
          stato: { in: ['PAGATO', 'PRONTO', 'IN_PREPARAZIONE', 'RITIRATO'] }
        }
      },
      orderBy: {
        _sum: {
          quantita: 'desc'
        }
      },
      take: 10
    });

    // Get product details
    const productIds = topProducts.map(p => p.prodottoId);
    const products = await prisma.prodotto.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nome: true }
    });

    const topSelling = topProducts.map(tp => {
      const product = products.find(p => p.id === tp.prodottoId);
      return {
        id: tp.prodottoId,
        nome: product?.nome || 'Prodotto sconosciuto',
        quantita: tp._sum.quantita || 0
      };
    });

    // Count out of stock products
    const outOfStock = await prisma.prodotto.count({
      where: {
        OR: [
          { terminato: true },
          {
            InventarioEsaurito: {
              quantitaDisponibile: 0
            }
          }
        ],
        disponibile: true,
        isDeleted: false
      }
    });

    return {
      success: true,
      data: {
        topSelling,
        outOfStock
      }
    };
  } catch (error) {
    secureLog.error('Error fetching product metrics:', error);
    return { 
      success: false, 
      error: 'Errore recupero metriche prodotti' 
    };
  }
}

/**
 * Recupera metriche sul personale
 */
export async function getStaffMetrics() {
  try {
    const user = await getCurrentUser();
    
    if (!user || !["SUPERVISORE", "ADMIN"].includes(user.ruolo)) {
      return { 
        success: false, 
        error: "Non autorizzato" 
      };
    }

    // Count active users by role
    const staffByRole = await prisma.user.groupBy({
      by: ['ruolo'],
      _count: true,
      where: {
        attivo: true
      }
    });

    // Get online users (last activity within 5 minutes)
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const onlineUsers = await prisma.user.count({
      where: {
        attivo: true,
        lastActive: { gte: fiveMinutesAgo }
      }
    });

    return {
      success: true,
      data: {
        byRole: staffByRole.map(s => ({
          role: s.ruolo,
          count: s._count
        })),
        online: onlineUsers,
        total: staffByRole.reduce((acc, s) => acc + s._count, 0)
      }
    };
  } catch (error) {
    secureLog.error('Error fetching staff metrics:', error);
    return { 
      success: false, 
      error: 'Errore recupero metriche personale' 
    };
  }
}