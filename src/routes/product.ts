import { Router, Request, Response } from 'express';
import { getProducts, addProduct, updateProduct, deleteProduct } from '../actions';
import { User } from '@prisma/client';

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management
 * 
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - acquisitionValue
 *         - quantity
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the product
 *         name:
 *           type: string
 *           description: The name of the product
 *         acquisitionValue:
 *           type: number
 *           format: float
 *           description: The cost to acquire one unit of the product
 *         quantity:
 *           type: integer
 *           description: The current quantity in stock
 *         initialQuantity:
 *           type: integer
 *           description: The initial quantity when the product was added
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the product was created
 *         userId:
 *           type: string
 *           description: The id of the user who owns the product
 *       example:
 *         id: cldqg8f2j0000m9z6qg8f2j00
 *         name: "Sample Product"
 *         acquisitionValue: 10.50
 *         quantity: 100
 *         initialQuantity: 100
 *         createdAt: "2025-01-01T00:00:00.000Z"
 *         userId: "clgqg8f2j0000m9z6qg8f2j00"
 */

const router = Router();

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Returns the list of all the user's products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of the products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

router.get('/products', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const products = await getProducts(req.user as User);
        res.json(products);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: The product was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/products', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const newProduct = await addProduct(req.user as User, req.body);
        res.json(newProduct);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The product id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: The product was updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: The product was not found
 *       500:
 *         description: Internal server error
 */
router.put('/products/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const updatedProduct = await updateProduct(req.user as User, req.body);
        res.json(updatedProduct);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The product id
 *     responses:
 *       204:
 *         description: The product was deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: The product was not found
 *       500:
 *         description: Internal server error
 */
router.delete('/products/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.sendStatus(401);
        }
        await deleteProduct(req.user as User, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
