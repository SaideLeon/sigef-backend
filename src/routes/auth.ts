import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
// This should be a URL to your frontend, which will receive the token
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'; 

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and registration
 */

// --- Native Authentication ---

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for the new user
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: User with this email already exists
 *       500:
 *         description: Internal server error
 */

router.post('/auth/register', async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for the user session
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials or user registered with Google
 *       500:
 *         description: Internal server error
 */
router.post('/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) {
            // User not found or user registered with Google so they have no password
            return res.status(401).json({ error: 'Invalid credentials or please use Google to sign in.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- Google OAuth ---

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Authentication]
 *     description: Redirects the user to the Google login page to start the OAuth 2.0 flow.
 *     responses:
 *       302:
 *         description: Redirect to Google's authentication server.
 */
// Step 1: User clicks "Login with Google", frontend redirects to this endpoint
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Step 2: Google redirects here after successful authentication
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req: Request, res: Response) => {
    const user = req.user as User;

    if (!user) {
      // This should not happen if authentication is successful
      return res.redirect(`${CLIENT_URL}/login?error=authentication-failed`);
    }

    // Step 4: Generate your own JWT
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    // Step 5: Redirect to the frontend with the token
    // The frontend will then save the token and use it for subsequent requests
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
  }
);

export default router;
