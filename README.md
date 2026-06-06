# Hair Diagnosis SaaS — Backend

This repository contains a production-minded Node.js (TypeScript) backend scaffold for an AI-powered Hair Diagnosis + Product Recommendation platform with WhatsApp integration.

Quick overview:

- Express server with modular services in `/src/services`
- Prisma (Postgres) schema in `/prisma/schema.prisma`
- API routes: `/api/chat`, `/api/diagnose`, `/api/whatsapp-webhook`

Getting started

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate` (configure DB first)
5. Start dev server: `npm run dev`

Notes

- LLM calls use OpenAI-compatible chat completions. Configure `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`.
- OpenAI example: `LLM_BASE_URL=https://api.openai.com/v1`
- Groq example: `LLM_BASE_URL=https://api.groq.com/openai/v1`
- WhatsApp endpoint is simplified; integrate with WhatsApp Cloud API to send messages (use `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`).
- RAG docs stored in `data/docs` for simple retrieval.
- Import `.xlsx` and `.docx` knowledge files with `npm run kb:import -- -SourceFiles "C:\path\file1.xlsx","C:\path\file2.docx"`.

Files of interest

- `src/services/orchestrator.ts` — mode/intents decision logic
- `src/services/diagnosis.ts` — diagnostic question flow and session persistence
- `src/services/llm.ts` & `src/services/rag.ts` — retrieve docs and call LLM for structured diagnosis
- `src/services/productMapper.ts` — deterministic product mapping (no LLM)
- `src/services/response.ts` — create Hinglish response
- `prisma/schema.prisma` — DB schema
