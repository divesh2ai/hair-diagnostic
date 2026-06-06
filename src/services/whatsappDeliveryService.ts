/**
 * WhatsApp Delivery Service
 * 
 * Manages delivery of assessment reports via WhatsApp:
 * - Report delivery tracking
 * - Delivery retry logic
 * - Message template management
 * - Patient engagement
 */

import prisma from '../prismaClient';
import { randomUUID } from 'crypto';
import type { WhatsappDelivery } from '@prisma/client';

export interface SendReportInput {
  assessmentId: string;
  patientPhone: string;
  reportUrl: string;
  patientName: string;
  clinicName: string;
}

export interface WhatsAppMessage {
  to: string;
  type: 'template' | 'text';
  template?: {
    name: string;
    language: string;
    parameters: Record<string, any>;
  };
  text?: string;
}

/**
 * Send report via WhatsApp to patient
 */
export async function sendReportViaWhatsApp(
  input: SendReportInput
): Promise<WhatsappDelivery> {
  const delivery = await prisma.whatsappDelivery.create({
    data: {
      assessmentId: input.assessmentId,
      patientPhone: input.patientPhone,
      templateId: 'REPORT_READY',
      status: 'PENDING',
      attempts: 0,
    },
  });

  // Queue delivery (would be processed by background worker in production)
  await queueWhatsAppDelivery(delivery.id, input);

  return delivery;
}

/**
 * Queue WhatsApp delivery for background processing
 */
async function queueWhatsAppDelivery(
  deliveryId: string,
  input: SendReportInput
): Promise<void> {
  // In production, this would add to a message queue (e.g., Bull, RabbitMQ)
  // For now, attempt delivery immediately with retry logic
  
  setTimeout(() => {
    attemptWhatsAppDelivery(deliveryId, input).catch((err) => {
      console.error(`Failed to queue WhatsApp delivery ${deliveryId}:`, err);
    });
  }, 1000);
}

/**
 * Attempt to deliver report via WhatsApp API
 */
async function attemptWhatsAppDelivery(
  deliveryId: string,
  input: SendReportInput
): Promise<void> {
  try {
    const delivery = await prisma.whatsappDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    if (delivery.attempts >= 3) {
      await prisma.whatsappDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          lastError: 'Max retries exceeded',
        },
      });
      return;
    }

    // Build WhatsApp message
    const message = buildReportMessage(input);

    // Call WhatsApp API (mock for now)
    const messageId = await callWhatsAppAPI(message);

    // Update delivery status
    await prisma.whatsappDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SENT',
        messageId,
        attempts: delivery.attempts + 1,
        deliveredAt: new Date(),
      },
    });

    console.log(`WhatsApp report delivered to ${input.patientPhone}`);
  } catch (error: any) {
    const delivery = await prisma.whatsappDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (delivery) {
      const nextAttempt = Math.min(
        1000 * Math.pow(2, delivery.attempts),
        30000
      );

      await prisma.whatsappDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: delivery.attempts + 1,
          lastError: error.message,
        },
      });

      // Retry after backoff
      if (delivery.attempts < 3) {
        setTimeout(
          () => attemptWhatsAppDelivery(deliveryId, input),
          nextAttempt
        );
      }
    }
  }
}

/**
 * Build WhatsApp report message
 */
function buildReportMessage(input: SendReportInput): WhatsAppMessage {
  return {
    to: normalizePhoneNumber(input.patientPhone),
    type: 'template',
    template: {
      name: 'HAIR_REPORT_READY',
      language: 'en',
      parameters: {
        patientName: input.patientName,
        clinicName: input.clinicName,
        reportLink: input.reportUrl,
      },
    },
  };
}

/**
 * Mock WhatsApp API call (replace with real API in production)
 */
async function callWhatsAppAPI(message: WhatsAppMessage): Promise<string> {
  // This would call Meta's WhatsApp Business API
  // For now, return a mock message ID
  console.log('Sending WhatsApp message:', message);
  
  // Mock implementation
  return `msg_${randomUUID()}`;
}

/**
 * Normalize phone number to WhatsApp format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Ensure it has country code (assume +91 for India if not present)
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Get delivery status
 */
export async function getDeliveryStatus(
  deliveryId: string
): Promise<WhatsappDelivery | null> {
  return prisma.whatsappDelivery.findUnique({
    where: { id: deliveryId },
  });
}

/**
 * Get all deliveries for assessment
 */
export async function getAssessmentDeliveries(
  assessmentId: string
): Promise<WhatsappDelivery[]> {
  return prisma.whatsappDelivery.findMany({
    where: { assessmentId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Retry failed delivery
 */
export async function retryDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.whatsappDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    throw new Error(`Delivery not found: ${deliveryId}`);
  }

  await prisma.whatsappDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'PENDING',
      attempts: 0,
    },
  });
}

export { sendReportViaWhatsApp };
