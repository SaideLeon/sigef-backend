import { Router, Request, Response } from 'express';
import { getSales, addSale, deleteSale } from '../actions';
import { User } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Sales
 *   description: Sale management
 * 
 * components:
 *   schemas:
 *     Sale:
 *       type: object
 *       required:
 *         - productId
 *         - quantitySold
 *         - saleValue
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the sale
 *         productId:
 *           type: string
 *           description: The id of the product that was sold
 *         productName:
 *           type: string
 *           description: The name of the product (denormalized)
 *         quantitySold:
 *           type: integer
 *           description: The quantity of the product that was sold
 *         saleValue:
 *           type: number
 *           format: float
 *           description: The total value of the sale
 *         isLoss:
 *           type: boolean
 *           description: Whether the transaction was a loss
 *         lossReason:
 *           type: string
 *           description: The reason for the loss
 *         profit:
 *           type: number
 *           format: float
 *           description: The calculated profit from the sale
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the sale was recorded
 *         userId:
 *           type: string
 *           description: The id of the user who made the sale
 *       example:
 *         id: cldqg8f2j0000m9z6qg8f2j01
 *         productId: "cldqg8f2j0000m9z6qg8f2j00"
 *         productName: "Sample Product"
 *         quantitySold: 2
 *         saleValue: 30.00
 *         isLoss: false
 *         lossReason: null
 *         profit: 9.00
 *         createdAt: "2025-01-02T00:00:00.000Z"
 *         userId: "clgqg8f2j0000m9z6qg8f2j00"
 */

const router = Router();

/**
 * @swagger
 * /sales:
 *   get:
 *     summary: Returns the list of all the user's sales
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of the sales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sale'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

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

/**
 * @swagger
 * /sales:
 *   post:
 *     summary: Create a new sale
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Sale'
 *     responses:
 *       200:
 *         description: The sale was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sale'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /sales/{id}:
 *   delete:
 *     summary: Delete a sale
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The sale id
 *     responses:
 *       204:
 *         description: The sale was deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: The sale was not found
 *       500:
 *         description: Internal server error
 */
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
