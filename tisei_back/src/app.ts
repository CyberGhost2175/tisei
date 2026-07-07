import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { errorHandler } from './common/errors/errorHandler.js';
import { MAX_ATTACHMENT_BYTES } from './common/storage/s3.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { requestRoutes } from './modules/requests/request.routes.js';
import { publicRoutes } from './modules/requests/public.routes.js';
import { closingFormRoutes } from './modules/closing-form/closing-form.routes.js';
import { usersRoutes } from './modules/users/user.routes.js';
import { clientsRoutes } from './modules/clients/client.routes.js';
import { commentsRoutes } from './modules/comments/comment.routes.js';
import { attachmentsRoutes } from './modules/attachments/attachment.routes.js';
import { notificationsRoutes } from './modules/notifications/notification.routes.js';
import { routingRoutes } from './modules/routing/routing.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { dictionariesRoutes } from './modules/dictionaries/dictionary.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { partnersRoutes } from './modules/partners/partner.routes.js';
import { serviceEquipmentRoutes } from './modules/service-equipment/service-equipment.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler(errorHandler);

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(cors, {
    origin: [env.FRONTEND_CRM_URL, env.FRONTEND_LANDING_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: { fileSize: MAX_ATTACHMENT_BYTES },
  });

  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    transform: jsonSchemaTransform,
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'TiSei CRM API',
        description:
          'Backend API for TiSei — refrigeration, climate and heating equipment repair company.',
        version: '1.0.0',
      },
      servers: [{ url: env.API_BASE_URL }],
      tags: [
        { name: 'Auth', description: 'Authentication & 2FA' },
        { name: 'Public', description: 'Public endpoints (landing form)' },
        { name: 'Requests', description: 'Service requests management' },
        { name: 'Closing Form', description: 'Closing form & financials' },
        { name: 'Users', description: 'User management' },
        { name: 'Clients', description: 'Client database' },
        { name: 'Comments', description: 'Request history feed' },
        { name: 'Attachments', description: 'File uploads' },
        { name: 'Notifications', description: 'Email & push notifications' },
        { name: 'Routing', description: 'Route optimization & maps' },
        { name: 'Analytics', description: 'Reports & KPI' },
        { name: 'Dictionaries', description: 'Reference data' },
        { name: 'Audit', description: 'Audit log' },
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
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(publicRoutes, { prefix: '/public' });
      await v1.register(requestRoutes, { prefix: '/requests' });
      await v1.register(closingFormRoutes, { prefix: '/requests/:id/closing-form' });
      await v1.register(commentsRoutes, { prefix: '/requests/:id/comments' });
      await v1.register(attachmentsRoutes, { prefix: '/requests/:id/attachments' });
      await v1.register(usersRoutes, { prefix: '/users' });
      await v1.register(clientsRoutes, { prefix: '/clients' });
      await v1.register(notificationsRoutes, { prefix: '/notifications' });
      await v1.register(routingRoutes, { prefix: '/routing' });
      await v1.register(analyticsRoutes, { prefix: '/analytics' });
      await v1.register(dictionariesRoutes, { prefix: '/dictionaries' });
      await v1.register(partnersRoutes, { prefix: '/partners' });
      await v1.register(serviceEquipmentRoutes, { prefix: '/service-equipment' });
      await v1.register(auditRoutes, { prefix: '/audit-log' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
