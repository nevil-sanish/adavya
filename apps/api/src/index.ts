import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { loadEnv } from './config/load-env.js';
import { initializeFirebaseAdmin } from './config/firebase.js';
import { authRouter } from './routes/auth.routes.js';
import { teamRouter } from './routes/team.routes.js';
import { taskRouter } from './routes/task.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { leaderboardRouter } from './routes/leaderboard.routes.js';

// Load environment variables from the repository's single .env
loadEnv();

// Initialize Firebase Admin
initializeFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 5000;
const MOBILE_URL = process.env.MOBILE_URL || 'http://localhost:5174';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(
  cors({
    origin: [FRONTEND_URL, MOBILE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'adavya-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/teams', teamRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/admin', adminRouter);
app.use('/api/leaderboard', leaderboardRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Endpoint ${req.method} ${req.url} does not exist.`,
  });
});

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Adavya Backend listening on http://localhost:${PORT}`);
  console.log(`🌍 Accepting CORS from: ${FRONTEND_URL}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

export default app;
