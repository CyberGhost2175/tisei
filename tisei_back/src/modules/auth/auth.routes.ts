import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { messageResponseSchema } from '../../common/validation/common.schemas.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { z } from 'zod';
import {
  loginBodySchema,
  verify2faBodySchema,
  totpCodeBodySchema,
  disable2faBodySchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  changePasswordBodySchema,
  authTokensResponseSchema,
  loginResponseSchema,
} from './auth.schemas.js';
import {
  login,
  verify2faAndLogin,
  refreshAccessToken,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  setup2fa,
  enable2fa,
  disable2fa,
  REFRESH_COOKIE,
} from './auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Вход по email и паролю',
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
        },
      },
      config: {
        rateLimit: {
          max: Number(process.env.LOGIN_RATE_MAX ?? 10),
          timeWindow: process.env.LOGIN_RATE_WINDOW ?? '1 minute',
        },
      },
    },
    async (request, reply) => {
      return login(request.body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      }, reply);
    },
  );

  r.post(
    '/2fa/verify',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Подтверждение 2FA после логина',
        body: verify2faBodySchema,
        response: { 200: authTokensResponseSchema },
      },
    },
    async (request, reply) => {
      return verify2faAndLogin(request.body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      }, reply);
    },
  );

  r.post(
    '/2fa/setup',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Настройка 2FA — генерация секрета и QR',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ secret: z.string(), qrCodeDataUrl: z.string() }),
        },
      },
    },
    async (request) => setup2fa(request.authUser!.id),
  );

  r.post(
    '/2fa/enable',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Включить 2FA после подтверждения кода',
        security: [{ bearerAuth: [] }],
        body: totpCodeBodySchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => enable2fa(request.authUser!.id, request.body.code),
  );

  r.post(
    '/2fa/disable',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Отключить 2FA',
        security: [{ bearerAuth: [] }],
        body: disable2faBodySchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) =>
      disable2fa(request.authUser!.id, request.body.password, request.body.code),
  );

  r.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Обновление access-токена (sliding session)',
        response: { 200: authTokensResponseSchema },
      },
    },
    async (request, reply) => {
      const refreshToken = request.cookies[REFRESH_COOKIE];
      return refreshAccessToken(refreshToken, reply);
    },
  );

  r.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Выход — отзыв refresh-токена',
        response: { 200: messageResponseSchema },
      },
    },
    async (request, reply) => {
      await logout(request.cookies[REFRESH_COOKIE], reply);
      return { message: 'Вы успешно вышли из системы' };
    },
  );

  r.post(
    '/change-password',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Смена пароля текущего пользователя',
        security: [{ bearerAuth: [] }],
        body: changePasswordBodySchema,
        response: { 200: messageResponseSchema },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request) =>
      changePassword(
        request.authUser!.id,
        request.body.currentPassword,
        request.body.newPassword,
      ),
  );

  r.post(
    '/password-reset/request',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Запрос ссылки для сброса пароля',
        body: passwordResetRequestSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await requestPasswordReset(request.body.email);
      return { message: 'Если аккаунт существует, ссылка для сброса отправлена на email' };
    },
  );

  r.post(
    '/password-reset/confirm',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Подтверждение сброса пароля',
        body: passwordResetConfirmSchema,
        response: { 200: messageResponseSchema },
      },
    },
    async (request) => {
      await confirmPasswordReset(request.body.token, request.body.newPassword);
      return { message: 'Пароль успешно изменён' };
    },
  );
}
