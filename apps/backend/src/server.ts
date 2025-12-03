/**
 * Express server - Refactored and organized
 */
import express from 'express';
import path from 'path';
import * as dotenv from 'dotenv';
import { logger } from './utils/logger';
import { serverConfig } from './config/server.config';
import { corsMiddleware } from './api/middleware/cors';
import { errorHandler } from './api/middleware/error-handler';
import routes from './api/routes';
import { preInitializeAgent } from './services/agent.service';
import { initializeLetta } from './utils/letta-client';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(corsMiddleware);

// Routes
app.use(routes);

// Serve static files from frontend directory (development only)
if (serverConfig.nodeEnv === 'development' || serverConfig.serveFrontend) {
  app.use(express.static(path.join(process.cwd(), '../frontend')));
}

// Error handler (must be last)
app.use(errorHandler);

// Export app for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (!serverConfig.isVercel) {
  // Pre-initialize agent in background
  preInitializeAgent().catch(err => {
    logger.warn('Background agent pre-initialization failed:', err);
  });

  // Initialize Letta for long-term memory and learning (optional)
  initializeLetta().catch(err => {
    logger.warn('Letta initialization failed (optional):', err);
  });

  app.listen(serverConfig.port, '0.0.0.0', () => {
    logger.info(`Server listening on port ${serverConfig.port}`);
    logger.info(`Environment: ${serverConfig.nodeEnv}`);
  });
}
