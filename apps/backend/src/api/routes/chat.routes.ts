/**
 * Chat routes
 */
import { Router } from 'express';
import { handleChat } from '../controllers/chat.controller';
import { validateMessage } from '../middleware/validation';

const router = Router();

router.post('/chat', validateMessage, handleChat);

export default router;
