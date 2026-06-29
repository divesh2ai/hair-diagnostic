import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy /api/consultation to the main Express API running on PORT 4000
  app.all("/api/consultation*", async (req, res) => {
    try {
      const url = `http://localhost:4000${req.originalUrl}`;
      const response = await fetch(url, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          // Pass down any client headers like auth/actor data
          "x-actor-id": req.headers["x-actor-id"] as string || "",
          "x-actor-role": req.headers["x-actor-role"] as string || "",
          "x-clinic-id": req.headers["x-clinic-id"] as string || "",
        },
        body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Consultation proxy error:", err);
      res.status(500).json({ error: "Failed to connect to consultation backend" });
    }
  });

  // Dashboard Analytics Endpoint
  app.get("/api/dashboard", async (req, res) => {
    try {
      // In a real app, you would use admin SDK here. 
      // For this environment, we'll suggest a structure or use a mock for demonstration
      // that could be replaced by real firestore queries if we had admin initialized.
      // Since we are inside the same process as the frontend (conceptually), 
      // we can't easily use the client SDK here without auth context.
      // However, we'll provide the structured response the UI expects.
      res.json({
        totalClinics: 12,
        activeDoctors: 45,
        patientsToday: 128,
        totalReports: 2450,
        growth: 15.4
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // AI Diagnosis Endpoint
  app.post("/api/ai-diagnosis", async (req, res) => {
    try {
      const { questionnaireAnswers } = req.body;
      
      const prompt = `
        Analyze the following hair health questionnaire answers and provide a structured diagnosis.
        Answers: ${JSON.stringify(questionnaireAnswers)}
        
        Return a JSON object with:
        {
          "hairScore": number (0-100),
          "diagnosis": string (detailed analysis),
          "risk": "low" | "medium" | "high",
          "recommendedProducts": string[],
          "aiConfidence": number (0-100, your confidence in this diagnosis),
          "aiReasoning": string[] (top 3 factors leading to this diagnosis),
          "aiKits": string[] (recommended treatment kits, e.g., "Hair Regrowth Kit", "Scalp Care Kit")
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error) {
      console.error("AI Diagnosis Error:", error);
      res.status(500).json({ error: "Failed to generate diagnosis" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
