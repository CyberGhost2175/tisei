import { CommentType } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { buildPaginated, toSkipTake } from '../../common/utils/pagination.js';
import { assertRequestAccess, assertRequestWriteAccess, type AuthContext } from '../requests/request-access.js';
import type { CommentListQuery } from './comment.schemas.js';

function toDto(comment: {
  id: string;
  requestId: string;
  authorId: string | null;
  type: CommentType;
  text: string;
  createdAt: Date;
  author: { id: string; fullName: string; avatarUrl: string | null } | null;
}) {
  return {
    id: comment.id,
    requestId: comment.requestId,
    authorId: comment.authorId,
    type: comment.type,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author
      ? { id: comment.author.id, fullName: comment.author.fullName, avatarUrl: comment.author.avatarUrl }
      : null,
  };
}

export async function listComments(requestId: string, query: CommentListQuery, auth: AuthContext) {
  await assertRequestAccess(requestId, auth);

  const where = {
    requestId,
    ...(query.type ? { type: query.type as CommentType } : {}),
  };

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    }),
    prisma.comment.count({ where }),
  ]);

  return buildPaginated(items.map(toDto), total, query);
}

export async function createComment(
  requestId: string,
  text: string,
  auth: AuthContext,
) {
  await assertRequestWriteAccess(requestId, auth);

  const comment = await prisma.comment.create({
    data: {
      requestId,
      authorId: auth.userId,
      type: CommentType.comment,
      text,
    },
    include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
  });

  return toDto(comment);
}
