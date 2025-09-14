import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SIGEF Backend API',
      version: '1.0.0',
      description: 'API documentation for the SIGEF backend application.',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}/api`,
        description: 'Development server',
      },
      {
        url: 'https://sigef.cognick.qzz.io/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`[swagger]: API docs available at http://localhost:${process.env.PORT || 3001}/api-docs`);
};
