import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sseMetrics } from "@/lib/sse/sse-metrics";
import { sseLogger } from "@/lib/sse/sse-logger";

export async function GET(request: NextRequest) {
  // Authentication check - only admins can view metrics
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return new Response("Unauthorized: No token provided", { status: 401 });
  }
  
  const tokenData = verifyToken(token);
  if (!tokenData) {
    return new Response("Unauthorized: Invalid token", { status: 401 });
  }
  
  // Get user details and check if admin
  const user = await prisma.user.findUnique({
    where: { id: tokenData.userId },
    select: {
      id: true,
      ruolo: true,
      attivo: true
    }
  });
  
  if (!user || !user.attivo || (user.ruolo !== "ADMIN" && user.ruolo !== "MANAGER")) {
    return new Response("Forbidden: Admin access required", { status: 403 });
  }
  
  // Get metrics data
  const metrics = sseMetrics.getMetrics();
  const connectionMetrics = sseMetrics.getAllConnectionMetrics();
  const metricsHistory = sseMetrics.getMetricsHistory();
  const logStats = sseLogger.getLogStats();
  const recentLogs = sseLogger.getRecentLogs(50);
  
  // Prepare response
  const response = {
    timestamp: new Date().toISOString(),
    metrics,
    connections: connectionMetrics.map(conn => ({
      clientId: conn.clientId,
      userId: conn.userId,
      role: conn.role,
      connectedAt: new Date(conn.connectedAt).toISOString(),
      uptime: Date.now() - conn.connectedAt,
      messagesSent: conn.messagesSent,
      messagesAcknowledged: conn.messagesAcknowledged,
      errors: conn.errors,
      averageLatency: conn.latencies.length > 0 
        ? conn.latencies.reduce((a, b) => a + b, 0) / conn.latencies.length 
        : 0
    })),
    history: metricsHistory.slice(-20), // Last 20 snapshots
    logging: {
      stats: logStats,
      recentErrors: recentLogs.filter(log => log.level === 3) // Only errors
    },
    system: {
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  };
  
  return Response.json(response);
}