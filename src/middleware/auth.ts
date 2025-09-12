import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.sendStatus(403); // Forbidden
            }

            try {
                const jwtUser = decoded as { userId: string };
                if (!jwtUser || !jwtUser.userId) {
                    return res.sendStatus(401); // Unauthorized
                }

                const user = await prisma.user.findUnique({ where: { id: jwtUser.userId } });

                if (!user) {
                    return res.sendStatus(401); // Unauthorized
                }

                req.user = user;
                next();
            } catch (error) {
                return res.sendStatus(500); // Internal Server Error
            }
        });
    } else {
        res.sendStatus(401); // Unauthorized
    }
};