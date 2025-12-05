/**
 * A2A (Agent-to-Agent) Protocol Routes
 * Implements A2A v0.2.6 specification
 */
import { Router } from 'express';
import { handleA2ARequest } from '../controllers/a2a.controller';

const router = Router();

// A2A protocol endpoint
router.post('/a2a', handleA2ARequest);

export default router;
