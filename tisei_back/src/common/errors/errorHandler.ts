import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from './AppError.js';
import { isProd } from '../../config/env.js';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Global Fastify error handler mapping domain errors, Zod validation errors and
 * Prisma known errors to consistent JSON responses. Secrets/passwords are never
 * echoed back — only field names from validation.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  let body: ErrorBody;

  if (error instanceof AppError) {
    body = {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  } else if (error instanceof ZodError) {
    body = {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Ошибка валидации входных данных',
      details: error.flatten(),
    };
  } else if ((error as { validation?: unknown }).validation) {
    // Fastify schema validation (fastify-type-provider-zod)
    body = {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: (error as { validation?: unknown }).validation,
    };
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    body = mapPrismaError(error);
  } else {
    const statusCode = (error as FastifyError).statusCode ?? 500;
    body = {
      statusCode,
      code: statusCode === 429 ? 'TOO_MANY_REQUESTS' : 'INTERNAL_ERROR',
      message:
        statusCode >= 500 && isProd ? 'Внутренняя ошибка сервера' : error.message,
    };
  }

  if (body.statusCode >= 500) {
    request.log.error({ err: error }, 'Unhandled error');
  } else {
    request.log.warn({ code: body.code, msg: body.message }, 'Request error');
  }

  void reply.status(body.statusCode).send({ error: body });
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): ErrorBody {
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        code: 'UNIQUE_CONSTRAINT',
        message: 'Запись с такими данными уже существует',
        details: { target: error.meta?.target },
      };
    case 'P2025':
      return {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Запись не найдена',
      };
    case 'P2003':
      return {
        statusCode: 400,
        code: 'FOREIGN_KEY',
        message: 'Нарушение внешнего ключа',
        details: { field: error.meta?.field_name },
      };
    default:
      return {
        statusCode: 400,
        code: `PRISMA_${error.code}`,
        message: isProd ? 'Ошибка базы данных' : error.message,
      };
  }
}
