import { Router, Request, Response } from 'express';
import { getProducts, addProduct, updateProduct, deleteProduct } from '../actions';
import { User } from '@prisma/client';

const router = Router();

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
