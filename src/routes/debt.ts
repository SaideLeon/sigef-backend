import { Router, Request, Response } from 'express';
import { getDebts, addDebt, updateDebt, deleteDebt } from '../actions';
import { User } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Debts
 *   description: Debt management (receivables and payables)
 * 
 * components:
 *   schemas:
 *     Debt:
 *       type: object
 *       required:
 *         - type
 *         - description
 *         - amount
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the debt
 *         type:
 *           type: string
 *           enum: [receivable, payable]
 *           description: The type of debt
 *         description:
 *           type: string
 *           description: A description of the debt
 *         amount:
 *           type: number
 *           format: float
 *           description: The total amount of the debt
 *         amountPaid:
 *           type: number
 *           format: float
 *           description: The amount that has been paid
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: The due date for the debt
 *         status:
 *           type: string
 *           enum: [PENDING, PAID, PARTIALLY_PAID]
 *           description: The status of the debt
 *         contactName:
 *           type: string
 *           description: The name of the person or entity related to the debt
 *         paidAt:
 *           type: string
 *           format: date-time
 *           description: The date the debt was fully paid
 *         relatedSaleId:
 *           type: string
 *           description: The id of a sale related to this debt
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the debt was recorded
 *         userId:
 *           type: string
 *           description: The id of the user who owns the debt
 *       example:
 *         id: cldqg8f2j0000m9z6qg8f2j02
 *         type: "receivable"
 *         description: "Sale to John Doe"
 *         amount: 100.00
 *         amountPaid: 50.00
 *         dueDate: "2025-02-01T00:00:00.000Z"
 *         status: "PARTIALLY_PAID"
 *         contactName: "John Doe"
 *         paidAt: null
 *         relatedSaleId: "cldqg8f2j0000m9z6qg8f2j01"
 *         createdAt: "2025-01-02T00:00:00.000Z"
 *         userId: "clgqg8f2j0000m9z6qg8f2j00"
 */

const router = Router();

/**
 * @swagger
 * /debts:
 *   get:
 *     summary: Returns the list of all the user's debts
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of the debts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Debt'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

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

/**
 * @swagger
 * /debts:
 *   post:
 *     summary: Create a new debt
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Debt'
 *     responses:
 *       200:
 *         description: The debt was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Debt'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /debts/{id}:
 *   put:
 *     summary: Update a debt
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The debt id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Debt'
 *     responses:
 *       200:
 *         description: The debt was updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Debt'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: The debt was not found
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /debts/{id}:
 *   delete:
 *     summary: Delete a debt
 *     tags: [Debts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The debt id
 *     responses:
 *       204:
 *         description: The debt was deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: The debt was not found
 *       500:
 *         description: Internal server error
 */
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
