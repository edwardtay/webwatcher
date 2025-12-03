/**
 * URL analysis routes
 */
import { Router } from 'express';
import { handleUrlCheck } from '../controllers/url.controller';
import { validateUrl } from '../middleware/validation';

const router = Router();

router.post('/check', validateUrl, handleUrlCheck);

export default router;
