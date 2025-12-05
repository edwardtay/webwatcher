/**
 * Route aggregator
 */
import { Router } from 'express';
import chatRoutes from './chat.routes';
import urlRoutes from './url.routes';
import healthRoutes from './health.routes';
import securityRoutes from './security.routes';
import a2aRoutes from './a2a.routes';

const router = Router();

// Mount routes
router.use('/api', chatRoutes);
router.use('/api', securityRoutes);
router.use('/api', a2aRoutes);
router.use('/', urlRoutes);
router.use('/', healthRoutes);

export default router;
