import { Router, Request, Response } from 'express';
import { getAllUsersWithSubscription, getPlans, createPlan, updateUserSubscription, deactivateSubscription } from '../actions';
import { PlanName, User } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only operations
 */

const router = Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users with their subscription info
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not an admin)
 *       500:
 *         description: Internal server error
 */

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

/**
 * @swagger
 * /admin/plans:
 *   get:
 *     summary: Get all available subscription plans
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of plans
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not an admin)
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /admin/plans:
 *   post:
 *     summary: Create a new subscription plan
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planName:
 *                 type: string
 *                 enum: [GRATUITO, PROFISSIONAL, EMPRESARIAL]
 *     responses:
 *       200:
 *         description: The created plan
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not an admin)
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /admin/users/{userId}/subscription:
 *   put:
 *     summary: Create or update a user's subscription
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscription:
 *                 type: object
 *                 properties:
 *                   plan:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                   startDate:
 *                     type: string
 *                     format: date-time
 *                   endDate:
 *                     type: string
 *                     format: date-time
 *                   isActive:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: The updated subscription
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not an admin)
 *       500:
 *         description: Internal server error
 */
router.put('/admin/users/:userId/subscription', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const { subscription } = req.body;
        if (!subscription) {
            return res.status(400).json({ error: 'Request body must include a "subscription" object.' });
        }
        const { plan, startDate, endDate, isActive } = subscription;
        if (!plan || !plan.id || !startDate || !endDate || typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'Subscription object must include plan.id, startDate, endDate, and isActive (boolean).' });
        }
        const updatedSubscription = await updateUserSubscription(req.user as User, req.params.userId, plan.id, new Date(startDate), new Date(endDate), isActive);
        res.json(updatedSubscription);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /admin/subscriptions/{subscriptionId}:
 *   delete:
 *     summary: Deactivate a user's subscription
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         schema:
 *           type: string
 *         required: true
 *         description: The subscription id
 *     responses:
 *       204:
 *         description: Subscription deactivated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user is not an admin)
 *       500:
 *         description: Internal server error
 */
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
