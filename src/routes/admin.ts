import { Router, Request, Response } from 'express';
import { getAllUsersWithSubscription, getPlans, createPlan, updateUserSubscription, deactivateSubscription } from '../actions';
import { PlanName, User } from '@prisma/client';

const router = Router();

router.get('/admin/users', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const users = await getAllUsersWithSubscription(req.user as User);
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/admin/plans', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const plans = await getPlans(req.user as User);
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/admin/plans', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const { planName } = req.body;
        const newPlan = await createPlan(req.user as User, planName as PlanName);
        res.json(newPlan);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/admin/users/:userId/subscription', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const { planId, durationInDays } = req.body;
        const updatedSubscription = await updateUserSubscription(req.user as User, req.params.userId, planId, durationInDays);
        res.json(updatedSubscription);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/admin/subscriptions/:subscriptionId', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        await deactivateSubscription(req.user as User, req.params.subscriptionId);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
