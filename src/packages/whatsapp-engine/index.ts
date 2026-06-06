/**
 * HairOS WhatsApp Engine — Meta Cloud API integration scaffold
 */

export interface WhatsappConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

export interface ReportDeliveryRequest {
  assessmentId: string;
  patientPhone: string;
  patientName: string;
  reportUrl: string;
  language?: string;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
}

const TEMPLATES: Record<string, { name: string; language: string }> = {
  report_ready_en: { name: "hairos_report_ready", language: "en" },
  report_ready_hi: { name: "hairos_report_ready", language: "hi" },
};

export function resolveTemplate(language = "en") {
  return TEMPLATES[`report_ready_${language}`] ?? TEMPLATES.report_ready_en;
}

export async function sendReportViaWhatsapp(
  config: WhatsappConfig,
  request: ReportDeliveryRequest
): Promise<DeliveryResult> {
  const template = resolveTemplate(request.language);
  const apiVersion = config.apiVersion ?? "v21.0";
  const url = `https://graph.facebook.com/${apiVersion}/${config.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: request.patientPhone.replace(/\D/g, ""),
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: request.patientName },
                { type: "text", text: request.reportUrl },
              ],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err, attempts: 1 };
    }

    const data = (await res.json()) as { messages?: { id: string }[] };
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      attempts: 1,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      attempts: 1,
    };
  }
}

export async function sendWithRetry(
  config: WhatsappConfig,
  request: ReportDeliveryRequest,
  maxAttempts = 3
): Promise<DeliveryResult> {
  let last: DeliveryResult = { success: false, attempts: 0 };
  for (let i = 0; i < maxAttempts; i++) {
    last = await sendReportViaWhatsapp(config, request);
    last.attempts = i + 1;
    if (last.success) return last;
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  return last;
}
