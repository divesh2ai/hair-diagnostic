import axios from 'axios';
import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } from '../config';

const API_BASE = (version = 'v17.0') => `https://graph.facebook.com/${version}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

export async function sendText(to: string, text: string) {
  const url = API_BASE();
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };
  try {
    const res = await axios.post(url, body, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, timeout: 15000 });
    return res.data;
  } catch (err: any) {
    console.error('WhatsApp sendText failed:', err?.response?.data || err?.message || err);
    throw err;
  }
}

export async function sendButtons(to: string, text: string, buttons: { id: string; title: string }[]) {
  const url = API_BASE();
  const interactiveButtons = {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) }
    }
  } as any;

  const body = { messaging_product: 'whatsapp', to, ...interactiveButtons };
  try {
    const res = await axios.post(url, body, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, timeout: 15000 });
    return res.data;
  } catch (err: any) {
    console.error('WhatsApp sendButtons failed:', err?.response?.data || err?.message || err);
    throw err;
  }
}
