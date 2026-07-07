import 'fastify';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by the authenticate middleware for protected routes. */
    authUser?: AuthUser;
  }
}
