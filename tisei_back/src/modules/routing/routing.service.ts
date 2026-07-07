import type { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { BadRequestError, ForbiddenError } from '../../common/errors/AppError.js';
import { DEPOT_CENTER, DEPOT_ADDRESS, geocodeAddress } from '../../common/geocode/geocode-address.js';
import type { OptimizeRouteBody, RoutingTodayQuery } from './routing.schemas.js';

export interface RoutePoint {
  requestId: string;
  number: string;
  companyOrFullName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  priority: string;
  isPartner: boolean;
  order: number;
}

export const ROUTE_DEPOT = {
  address: DEPOT_ADDRESS,
  latitude: DEPOT_CENTER.latitude,
  longitude: DEPOT_CENTER.longitude,
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPartnerPoint(p: { partnerEstablishmentId?: string | null; isPartner?: boolean }) {
  return !!p.partnerEstablishmentId || p.isPartner === true;
}

function nearestNeighborOrder<T extends { latitude: number; longitude: number }>(
  points: T[],
  startLat: number,
  startLon: number,
): T[] {
  if (points.length <= 1) return [...points];

  const remaining = [...points];
  const ordered: T[] = [];
  let currentLat = startLat;
  let currentLon = startLon;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i]!;
      const dist = haversineKm(currentLat, currentLon, p.latitude, p.longitude);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0]!;
    ordered.push(next);
    currentLat = next.latitude;
    currentLon = next.longitude;
  }

  return ordered;
}

/**
 * Партнёрские точки — в начале маршрута (ближайший сосед от базы),
 * затем остальные точки от последней партнёрской или от базы.
 */
export function optimizeRouteOrder<
  T extends { latitude: number; longitude: number; partnerEstablishmentId?: string | null; isPartner?: boolean },
>(points: T[], startLat: number, startLon: number): T[] {
  if (points.length <= 1) return [...points];

  const partners = points.filter((p) => isPartnerPoint(p));
  const regular = points.filter((p) => !isPartnerPoint(p));

  const orderedPartners = nearestNeighborOrder(partners, startLat, startLon);
  const last = orderedPartners.at(-1);
  const regStartLat = last?.latitude ?? startLat;
  const regStartLon = last?.longitude ?? startLon;
  const orderedRegular = nearestNeighborOrder(regular, regStartLat, regStartLon);

  return [...orderedPartners, ...orderedRegular];
}

export function build2GisRouteUrl(
  points: Array<{ latitude: number; longitude: number }>,
  depot = ROUTE_DEPOT,
): string {
  const all = [depot, ...points];
  if (all.length === 0) return '';
  const coords = all.map((p) => `${p.longitude},${p.latitude}`).join('|');
  return `https://2gis.kz/directions/points/${coords}`;
}

function estimateTotalDistance(
  points: Array<{ latitude: number; longitude: number }>,
  depot = ROUTE_DEPOT,
) {
  const chain = [depot, ...points];
  let total = 0;
  for (let i = 1; i < chain.length; i++) {
    total += haversineKm(
      chain[i - 1]!.latitude,
      chain[i - 1]!.longitude,
      chain[i]!.latitude,
      chain[i]!.longitude,
    );
  }
  return Math.round(total * 100) / 100;
}

function buildRouteResponse(
  executorId: string,
  ordered: Array<Omit<RoutePoint, 'order'>>,
  date?: string,
) {
  const points = ordered.map((p, i) => ({ ...p, order: i + 1 }));
  return {
    executorId,
    date,
    depot: ROUTE_DEPOT,
    points,
    routeUrl: build2GisRouteUrl(points),
    totalDistanceKm: estimateTotalDistance(points),
  };
}

type AuthContext = { userId: string; role: UserRole };

async function ensureRequestCoordinates(
  requests: Array<{
    id: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }>,
) {
  for (const r of requests) {
    if (r.latitude != null && r.longitude != null) continue;
    if (!r.address?.trim()) continue;

    const coords = await geocodeAddress(r.address);
    if (!coords) continue;

    await prisma.request.update({
      where: { id: r.id },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        geocodedAt: new Date(),
      },
    });
    r.latitude = coords.latitude;
    r.longitude = coords.longitude;
  }
}

async function fetchActiveRequestsForExecutor(executorId: string) {
  return prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ['closed', 'cancelled'] },
      assignments: { some: { executorId } },
    },
    select: {
      id: true,
      number: true,
      companyOrFullName: true,
      address: true,
      latitude: true,
      longitude: true,
      status: true,
      priority: true,
      partnerEstablishmentId: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

function toRoutePoint(r: {
  id: string;
  number: string;
  companyOrFullName: string;
  address: string | null;
  latitude: number;
  longitude: number;
  status: string;
  priority: string;
  partnerEstablishmentId: string | null;
}): Omit<RoutePoint, 'order'> {
  return {
    requestId: r.id,
    number: r.number,
    companyOrFullName: r.companyOrFullName,
    address: r.address ?? '',
    latitude: r.latitude,
    longitude: r.longitude,
    status: r.status,
    priority: r.priority,
    isPartner: !!r.partnerEstablishmentId,
  };
}

export async function getTodayRoute(query: RoutingTodayQuery, auth: AuthContext) {
  let executorId = query.executorId ?? auth.userId;

  if (auth.role === 'executor' && executorId !== auth.userId) {
    throw new ForbiddenError('Исполнитель может смотреть только свой маршрут');
  }

  const date = query.date ?? new Date();
  const requests = await fetchActiveRequestsForExecutor(executorId);
  await ensureRequestCoordinates(requests);

  const points = requests
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => toRoutePoint({ ...r, latitude: r.latitude!, longitude: r.longitude! }));

  const ordered = optimizeRouteOrder(points, DEPOT_CENTER.latitude, DEPOT_CENTER.longitude);

  return buildRouteResponse(executorId, ordered, date.toISOString().slice(0, 10));
}

export async function optimizeRoute(body: OptimizeRouteBody, auth: AuthContext) {
  const executorId = body.executorId ?? auth.userId;

  if (auth.role === 'executor' && executorId !== auth.userId) {
    throw new ForbiddenError('Исполнитель может оптимизировать только свой маршрут');
  }

  const requests = await prisma.request.findMany({
    where: {
      id: { in: body.requestIds },
      deletedAt: null,
      assignments: auth.role === 'executor' ? { some: { executorId: auth.userId } } : undefined,
    },
    select: {
      id: true,
      number: true,
      companyOrFullName: true,
      address: true,
      latitude: true,
      longitude: true,
      status: true,
      priority: true,
      partnerEstablishmentId: true,
    },
  });

  if (requests.length !== body.requestIds.length) {
    throw new BadRequestError('Одна или несколько заявок не найдены или недоступны');
  }

  await ensureRequestCoordinates(requests);

  const withoutCoords = requests.filter((r) => r.latitude == null || r.longitude == null);
  if (withoutCoords.length > 0) {
    throw new BadRequestError(
      `У заявок нет координат: ${withoutCoords.map((r) => r.number).join(', ')}`,
    );
  }

  const points = requests.map((r) =>
    toRoutePoint({ ...r, latitude: r.latitude!, longitude: r.longitude! }),
  );

  const startLat = body.startLat ?? DEPOT_CENTER.latitude;
  const startLon = body.startLon ?? DEPOT_CENTER.longitude;
  const ordered = optimizeRouteOrder(points, startLat, startLon);

  return buildRouteResponse(executorId, ordered);
}
