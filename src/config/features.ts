export const features = {
  sandboxQA: process.env.FEATURE_SANDBOX_QA !== "false",
  whatsappDelivery: process.env.FEATURE_WHATSAPP === "true",
  doctorDashboard: process.env.FEATURE_DOCTOR_DASHBOARD !== "false",
  adminDashboard: process.env.FEATURE_ADMIN_DASHBOARD !== "false",
  orchestrationPolling: true,
  regressionBaselines: true,
} as const;
