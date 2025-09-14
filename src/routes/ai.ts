import { Router, Request, Response } from 'express';
import { User } from '@prisma/client';
import { analyzeFinances } from '../ai/flows/financial-analysis-flow';
import { getInitialData } from '../actions';
import { prisma } from '../lib/prisma';

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
 *   get:
 *     summary: Perform financial analysis for the logged-in user using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currencyCode
 *         schema:
 *           type: string
 *         required: false
 *         description: The currency code to use for the analysis (e.g., BRL, USD). Defaults to BRL.
 *     responses:
 *       200:
 *         description: The financial analysis report
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden. AI analysis is a premium feature.
 *       500:
 *         description: Internal server error
 */

router.get('/ai/analyze-finances', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }

        if ((req.user as User).role !== 'ADMIN') {
            const userWithSubscription = await prisma.user.findUnique({
                where: { id: (req.user as User).id },
                include: { subscription: { include: { plan: true } } }
            });

            const subscription = userWithSubscription?.subscription;
            let isPaidAndActive = false;
            if (subscription && subscription.plan.name !== 'GRATUITO' && subscription.isActive && (!subscription.endDate || new Date(subscription.endDate) >= new Date())) {
                isPaidAndActive = true;
            }

            if (!isPaidAndActive) {
                return res.status(403).json({ error: "A análise com IA é um recurso premium. Contas gratuitas, inativas ou expiradas não têm acesso. Considere fazer um upgrade do seu plano." });
            }
        }

        const financialData = await getInitialData(req.user as User);
        const currencyCode = (req.query.currencyCode as string) || 'MZN';

        const analysisInput = {
            ...financialData,
            currencyCode: currencyCode,
        };

        const result = await analyzeFinances(analysisInput);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;