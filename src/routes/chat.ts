import { Router, Request, Response } from 'express';
import MultimodalChatSystem from '../services/multimodalChatSystem';
import UserRAGManager from '../services/userRAGManager';
import { ChatRequest } from '../types';
import { User } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Chat with an AI assistant
 * 
 * components:
 *   schemas:
 *     ChatRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           description: The user's message
 *         imageBase64:
 *           type: string
 *           description: A base64 encoded image
 *         conversationId:
 *           type: string
 *           description: The ID of the conversation
 *       example:
 *         message: "Hello, how are you?"
 *         conversationId: "conv_1629878400000_abcdef123"
 *     ChatResponse:
 *       type: object
 *       properties:
 *         response:
 *           type: string
 *           description: The AI's response
 *         conversationId:
 *           type: string
 *           description: The ID of the conversation
 *         sources:
 *           type: array
 *           items:
 *             type: string
 *           description: The sources used for the response
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: The timestamp of the response
 *       example:
 *         response: "I'm doing well, thank you for asking."
 *         conversationId: "conv_1629878400000_abcdef123"
 *         sources: ["User data"]
 *         timestamp: "2025-08-25T12:00:00.000Z"
 */

const router = Router();
const chatSystem = new MultimodalChatSystem();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Send a message to the chat AI
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: The AI's response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/chat', async (req: Request, res: Response) => {
  console.log('[POST /chat] Received request', { body: req.body });
  try {
    const user = req.user as User;
    if (!user) {
      console.error('[POST /chat] Unauthorized: No user found in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;
    console.log('[POST /chat] Authenticated user ID:', userId);

    const body: ChatRequest = req.body;
    if (!body.message) {
      console.error('[POST /chat] Bad request: Message is required');
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await chatSystem.handleRequest(userId, body);
    console.log('[POST /chat] Sending response:', response);

    return res.json(response);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /chat/refresh:
 *   put:
 *     summary: Refresh the user's data for the chat AI
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data refreshed successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/chat/refresh', async (req: Request, res: Response) => {
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
