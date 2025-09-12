import { Router, Request, Response } from 'express';
import { analyzeFinances } from '../ai/flows/financial-analysis-flow';

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered financial analysis
 */

const router = Router();

/**
 * @swagger
 * /ai/analyze-finances:
 *   post:
 *     summary: Perform financial analysis using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               products:
 *                 type: array
 *                 items: 
 *                   $ref: '#/components/schemas/Product'
 *               sales:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Sale'
 *               debts:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Debt'
 *               currencyCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: The financial analysis report
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

router.post('/ai/analyze-finances', async (req: Request, res: Response) => {
    try {
        const result = await analyzeFinances(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
