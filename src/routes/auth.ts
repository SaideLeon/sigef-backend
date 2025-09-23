import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '../shared/types';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
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
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: User already exists
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
      data: { name, email, password: hashedPassword },
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  console.log('[/auth/login]: Received login request for email:', req.body.email);
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('[/auth/login]: Missing email or password.');
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    console.log('[/auth/login]: Searching for user in database...');
    const user = await prisma.user.findUnique({ where: { email } });
    console.log('[/auth/login]: User search complete.');

    if (!user || !user.password) {
      console.log('[/auth/login]: User not found or is a Google account without a password.');
      return res.status(401).json({ error: 'Invalid credentials or Google account' });
    }

    console.log('[/auth/login]: Comparing password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('[/auth/login]: Password comparison complete.');
    if (!isPasswordValid) {
      console.log('[/auth/login]: Invalid password.');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[/auth/login]: Password is valid. Generating JWT...');
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    console.log('[/auth/login]: JWT generated.');

    const { password: _, ...userWithoutPassword } = user;

    console.log('[/auth/login]: Sending successful response.');
    res.json({ token, user: userWithoutPassword });
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
 */
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Authentication]
 */
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req: Request, res: Response) => {
    const user = req.user as User;

    if (!user) {
      return res.redirect(`${CLIENT_URL}/login?error=authentication-failed`);
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '9h' });

    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
  }
);

export default router;
