import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requestIdParamSchema, commentListQuerySchema, createCommentBodySchema } from './comment.schemas.js';
import { listComments, createComment } from './comment.service.js';

const commentResponseSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  authorId: z.string().nullable(),
  type: z.enum(['comment', 'system_event']),
  text: z.string(),
  createdAt: z.string(),
  author: z
    .object({
      id: z.string(),
      fullName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
});

export async function commentsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Comments'],
        summary: 'Лента комментариев и событий заявки',
        security: [{ bearerAuth: [] }],
        params: requestIdParamSchema,
        querystring: commentListQuerySchema,
        response: {
          200: z.object({
            items: z.array(commentResponseSchema),
            meta: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    async (request) =>
      listComments(request.params.id, request.query, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      }),
  );

  r.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Comments'],
        summary: 'Добавить комментарий к заявке',
        security: [{ bearerAuth: [] }],
        params: requestIdParamSchema,
        body: createCommentBodySchema,
        response: { 201: commentResponseSchema },
      },
    },
    async (request, reply) => {
      const comment = await createComment(request.params.id, request.body.text, {
        userId: request.authUser!.id,
        role: request.authUser!.role,
      });
      return reply.status(201).send(comment);
    },
  );
}
