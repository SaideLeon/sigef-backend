import { Router, Request, Response } from 'express';
import { HttpError } from '../shared/errors';
import { User } from '@prisma/client';
import { mongoService } from '../services/mongodb';
import { callSIGEFAgent } from '../ai/agent';

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI Chat assistant for inventory management
 */

const router = Router();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Start a new chat conversation with the SIGEF assistant
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The user's message
 *     responses:
 *       200:
 *         description: The assistant's response with new thread ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 threadId:
 *                   type: string
 *                 response:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Chat is a premium feature
 *       500:
 *         description: Internal server error
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.sendStatus(401);
    }

    const user = req.user as User;

    // Verificação de plano premium (similar à análise financeira)
    if (user.role !== 'ADMIN') {
      // Aqui você pode implementar a verificação de plano premium
      // Por agora, vamos assumir que está liberado para todos
    }

    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    // Conecta ao MongoDB
    const mongoClient = await mongoService.connect();
    
    // Gera thread ID único
    const threadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Starting chat for user ${user.email}:`, message);
    
    const response = await callSIGEFAgent(mongoClient, message, threadId, user);
    
    res.json({ threadId, response });
    
  } catch (error: any) {
    console.error('Error in chat:', error);
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /chat/{threadId}:
 *   post:
 *     summary: Continue an existing chat conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         schema:
 *           type: string
 *         required: true
 *         description: The conversation thread ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The user's message
 *     responses:
 *       200:
 *         description: The assistant's response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/chat/:threadId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.sendStatus(401);
    }

    const user = req.user as User;
    const { threadId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    // Conecta ao MongoDB
    const mongoClient = await mongoService.connect();
    
    console.log(`Continuing chat for user ${user.email}, thread ${threadId}:`, message);
    
    const response = await callSIGEFAgent(mongoClient, message, threadId, user);
    
    res.json({ response });
    
  } catch (error: any) {
    console.error('Error in chat continuation:', error);
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

export default router;