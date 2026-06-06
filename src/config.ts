import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 4000;
export const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
export const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
export const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
export const RAG_DOCS_PATH = process.env.RAG_DOCS_PATH || './data/docs';

export function getChatCompletionsUrl() {
	return `${LLM_BASE_URL}/chat/completions`;
}

export function validateEnv() {
	const missing: string[] = [];
	if (!LLM_API_KEY) missing.push('LLM_API_KEY');
	if (!DATABASE_URL) missing.push('DATABASE_URL');
	if (!WHATSAPP_TOKEN) missing.push('WHATSAPP_TOKEN');
	if (!WHATSAPP_PHONE_NUMBER_ID) missing.push('WHATSAPP_PHONE_NUMBER_ID');
	if (missing.length) {
		throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
	}
}
