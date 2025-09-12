import { Router, Request, Response } from 'express';
import { getSales, addSale, deleteSale } from '../actions';
import { User } from '@prisma/client';

const router = Router();

router.get('/sales', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const sales = await getSales(req.user as User);
        res.json(sales);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sales', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const newSale = await addSale(req.user as User, req.body);
        res.json(newSale);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/sales/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        await deleteSale(req.user as User, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
