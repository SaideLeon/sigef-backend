import { Router, Request, Response } from 'express';
import { analyzeFinances } from '../ai/flows/financial-analysis-flow';

const router = Router();

router.post('/ai/analyze-finances', async (req: Request, res: Response) => {
    try {
        const result = await analyzeFinances(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
