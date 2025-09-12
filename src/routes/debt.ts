import { Router, Request, Response } from 'express';
import { getDebts, addDebt, updateDebt, deleteDebt } from '../actions';
import { User } from '@prisma/client';

const router = Router();

router.get('/debts', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const debts = await getDebts(req.user as User);
        res.json(debts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/debts', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const newDebt = await addDebt(req.user as User, req.body);
        res.json(newDebt);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/debts/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const updatedDebt = await updateDebt(req.user as User, req.params.id, req.body);
        res.json(updatedDebt);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/debts/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        await deleteDebt(req.user as User, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
