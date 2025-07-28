"use server";

import { emitOrderUpdate, emitOrderReady, emitNotification } from "@/lib/sse/sse-service";

export async function notifyOrderUpdate(
  orderId: string,
  status: string,
  previousStatus?: string,
  updatedBy?: string
) {
  return emitOrderUpdate(orderId, status, previousStatus, updatedBy);
}

export async function notifyOrderReady(
  orderId: string,
  tableNumber: number | undefined,
  readyItems: string[]
) {
  return emitOrderReady(orderId, tableNumber, readyItems);
}

export async function sendNotification(
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  targetRoles?: string[],
  requiresAcknowledgment?: boolean
) {
  return emitNotification(title, message, priority, targetRoles, requiresAcknowledgment);
}