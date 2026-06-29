import express from "express";
import { createServer as createViteServer } from "vite";
import bodyParser from "body-parser";
import twilio from "twilio";
import { GoogleGenAI } from "@google/genai";
import { knowledgeBase } from "./src/knowledge.ts";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // In-memory store for dashboard message history
  const messages: any[] = [];

  // Webhook for Twilio WhatsApp
  app.post("/api/whatsapp", async (req, res) => {
    const incomingMsg = req.body.Body;
    const from = req.body.From;
    const to = req.body.To;

    messages.push({ from, to, body: incomingMsg, type: "incoming", timestamp: new Date() });

    try {
      const prompt = `
      You are a medical consultant for Fluence Pharma.
      Patient Symptoms: "${incomingMsg}"

      Knowledge Base of Fluence Pharma Hair Kits:
      ${JSON.stringify(knowledgeBase, null, 2)}

      Task:
      1. Understand and diagnose the symptoms.
      2. Recommend the EXACT product kit from the knowledge base.
      3. Provide proper reasoning as to why to consume/use it based on the ingredients and symptoms.
      4. Keep the response concise, empathetic, and formatted well for WhatsApp (use *bold* for emphasis, bullet points).
      5. If the symptoms do not match any hair kit, politely inform them and suggest consulting a doctor. Do not recommend products outside the knowledge base.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      const replyText = response.text || "I'm sorry, I couldn't process that request.";

      messages.push({ from: to, to: from, body: replyText, type: "outgoing", timestamp: new Date() });

      // Respond to Twilio with TwiML
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message(replyText);
      res.type("text/xml").send(twiml.toString());
    } catch (error) {
      console.error("Error processing WhatsApp message:", error);
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("Sorry, I am experiencing technical difficulties at the moment.");
      res.type("text/xml").send(twiml.toString());
    }
  });

  // Endpoint for the Web UI to test the chatbot without WhatsApp
  app.post("/api/test-chat", async (req, res) => {
    const { message } = req.body;
    try {
      const prompt = `
      You are a medical consultant for Fluence Pharma.
      Patient Symptoms: "${message}"

      Knowledge Base of Fluence Pharma Hair Kits:
      ${JSON.stringify(knowledgeBase, null, 2)}

      Task:
      1. Understand and diagnose the symptoms.
      2. Recommend the EXACT product kit from the knowledge base.
      3. Provide proper reasoning as to why to consume/use it based on the ingredients and symptoms.
      4. Keep the response concise, empathetic, and formatted well for WhatsApp (use *bold* for emphasis, bullet points).
      5. If the symptoms do not match any hair kit, politely inform them and suggest consulting a doctor. Do not recommend products outside the knowledge base.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      res.json({ reply: response.text });
    } catch (error) {
      console.error("Error in test chat:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  // Endpoint to fetch message history for the dashboard
  app.get("/api/messages", (req, res) => {
    res.json(messages);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
