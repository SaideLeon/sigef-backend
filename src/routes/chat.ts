import { Router, Request, Response } from 'express';
import MultimodalChatSystem from '../services/multimodalChatSystem';
import UserRAGManager from '../services/userRAGManager';
import { ChatRequest } from '../types';
import { User } from '@prisma/client';

const router = Router();
const chatSystem = new MultimodalChatSystem();

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    const body: ChatRequest = req.body;
    if (!body.message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await chatSystem.processUserMessage(userId, body);

    return res.json(response);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/refresh', async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    const ragManager = new UserRAGManager();
    await ragManager.refreshUserVectorStore(userId);

    return res.json({
      message: 'User data refreshed successfully',
    });
  } catch (error) {
    console.error('Refresh endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
