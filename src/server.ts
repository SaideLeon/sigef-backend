import express, { Express, Request, Response } from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { checkDbConnection } from './actions';
import { authenticateJWT } from './middleware/auth';
import passport from './lib/passport';
import authRoutes from './routes/auth';
import productRoutes from './routes/product';
import saleRoutes from './routes/sale';
import debtRoutes from './routes/debt';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import { setupSwagger } from './swagger';

const app: Express = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

const corsOptions = {
    origin: ['http://localhost:3080', 'http://localhost:3001', 'https://sigef.cognick.qzz.io'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(passport.initialize());

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/api/check-db', async (req: Request, res: Response) => {
  try {
    const isConnected = await checkDbConnection();
    res.json({ isConnected });
  } catch (error) {
    console.error("Database connection check failed:", error);
    res.status(500).json({ isConnected: false });
  }
});

// Auth routes (public)
app.use('/api', authRoutes);

// Authenticated routes
app.use('/api', authenticateJWT, productRoutes);
app.use('/api', authenticateJWT, saleRoutes);
app.use('/api', authenticateJWT, debtRoutes);
app.use('/api', authenticateJWT, adminRoutes);
app.use('/api', authenticateJWT, aiRoutes);

// Setup Swagger
setupSwagger(app);

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default server;
