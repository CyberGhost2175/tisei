import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { publicCreateRequestBodySchema } from '../requests/request.schemas.js';
import { createRequest } from '../requests/request.service.js';
// import { verifyRecaptcha } from '../../common/utils/recaptcha.js';
import { BadRequestError } from '../../common/errors/AppError.js';
import { uploadPublicAttachment } from '../attachments/attachment.service.js';
import { RequestSource } from '@prisma/client';
import { cuidSchema } from '../../common/validation/common.schemas.js';
import { attachmentResponseSchema } from '../attachments/attachment.schemas.js';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/requests',
    {
      schema: {
        tags: ['Public'],
        summary: 'Публичное создание заявки с сайта (rate limit)',
        body: publicCreateRequestBodySchema,
        response: {
          201: z.object({ id: z.string(), number: z.string() }),
        },
      },
      config: {
        rateLimit: {
          max: Number(process.env.PUBLIC_REQUEST_RATE_MAX ?? 5),
          timeWindow: process.env.PUBLIC_REQUEST_RATE_WINDOW ?? '1 minute',
        },
      },
    },
    async (request, reply) => {
      // reCAPTCHA временно отключена
      // await verifyRecaptcha(request.body.recaptchaToken);
      const { recaptchaToken: _, ...body } = request.body;
      const created = await createRequest(body, null, RequestSource.site);
      return reply.status(201).send({ id: created.id, number: created.number });
    },
  );

  r.post(
    '/requests/:id/attachments',
    {
      schema: {
        tags: ['Public'],
        summary: 'Публичная загрузка фото к заявке с лендинга (в течение 30 мин после создания)',
        consumes: ['multipart/form-data'],
        params: z.object({ id: cuidSchema }),
        response: { 201: attachmentResponseSchema },
      },
      config: {
        rateLimit: {
          max: Number(process.env.PUBLIC_REQUEST_RATE_MAX ?? 5),
          timeWindow: process.env.PUBLIC_REQUEST_RATE_WINDOW ?? '1 minute',
        },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) throw new BadRequestError('Файл не передан');

      const buffer = await data.toBuffer();
      const attachment = await uploadPublicAttachment(request.params.id, {
        buffer,
        filename: data.filename,
        mimetype: data.mimetype || 'application/octet-stream',
      });
      return reply.status(201).send(attachment);
    },
  );
}
