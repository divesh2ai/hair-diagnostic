import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import chatRoute from './routes/chat';
import diagnoseRoute from './routes/diagnose';
import whatsappRoute from './routes/whatsappWebhook';
import debugClinicalEngineRoute from './routes/debugClinicalEngine';
import assessmentsRoute from './routes/assessments';

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use('/api/assessments', assessmentsRoute);
app.use('/api/chat', chatRoute);
app.use('/api/diagnose', diagnoseRoute);
app.use('/api/whatsapp-webhook', whatsappRoute);
app.use('/api', debugClinicalEngineRoute);

app.get('/health', (req, res) => res.json({ ok: true }));

// Global error handler to ensure errors are turned into HTTP responses
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
	console.error('Unhandled error:', err?.message || err);
	res.status(500).json({ error: 'internal_server_error' });
});

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;