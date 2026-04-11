import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'byhadmade-jwt-secret-change-me';

export interface AuthRequest extends Request {
  /** Always the owner user id — sub-accounts act as their owner for data scoping. */
  userId?: string;
  /** Present only when a sub-account is logged in. */
  subAccountId?: string;
  /** Restaurants the caller is restricted to. Empty array = no restriction (full access). */
  allowedRestaurantIds?: string[];
  /** Menus the caller is restricted to. Empty array = no restriction (full access). */
  allowedMenuIds?: string[];
  /** Feature keys the caller is restricted to. Empty array = no restriction (full access). */
  allowedFeatures?: string[];
}

interface TokenPayload {
  userId: string;
  subAccountId?: string;
  allowedRestaurantIds?: string[];
  allowedMenuIds?: string[];
  allowedFeatures?: string[];
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.userId = decoded.userId;
    req.subAccountId = decoded.subAccountId;
    req.allowedRestaurantIds = decoded.allowedRestaurantIds || [];
    req.allowedMenuIds = decoded.allowedMenuIds || [];
    req.allowedFeatures = decoded.allowedFeatures || [];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Guard for routes only the owner user (not sub-accounts) may access,
 * e.g. managing sub-accounts themselves.
 */
export function requireOwner(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.subAccountId) {
    res.status(403).json({ error: 'Owner account required' });
    return;
  }
  next();
}

/** Helper for routes: does the caller have access to this restaurantId? */
export function canAccessRestaurant(req: AuthRequest, restaurantId: string): boolean {
  if (!req.subAccountId) return true; // owner: full access
  const allowed = req.allowedRestaurantIds || [];
  if (allowed.length === 0) return true; // empty = no restriction
  return allowed.includes(restaurantId);
}

/** Helper for routes: does the caller have access to this menuId? */
export function canAccessMenu(req: AuthRequest, menuId: string): boolean {
  if (!req.subAccountId) return true;
  const allowed = req.allowedMenuIds || [];
  if (allowed.length === 0) return true;
  return allowed.includes(menuId);
}

/**
 * Build a Prisma `where` fragment that scopes a query to the caller's allowed
 * restaurants when the caller is a sub-account with explicit restaurant
 * restrictions. Merge this into the route's main `where`.
 *
 * Usage:
 *   const where = { ...restaurantScope(req, 'id'), userId: req.userId! };
 */
export function restaurantScope(
  req: AuthRequest,
  field: string = 'id',
): Record<string, unknown> {
  if (!req.subAccountId) return {};
  const allowed = req.allowedRestaurantIds || [];
  if (allowed.length === 0) return {}; // no restriction
  return { [field]: { in: allowed } };
}

/** Helper: does the caller have access to this feature? */
export function canAccessFeature(req: AuthRequest, feature: string): boolean {
  if (!req.subAccountId) return true; // owner: full access
  const allowed = req.allowedFeatures || [];
  if (allowed.length === 0) return true; // empty = no restriction
  return allowed.includes(feature);
}

/** Middleware: require access to a specific feature. */
export function requireFeature(feature: string) {
  return function (req: AuthRequest, res: Response, next: NextFunction): void {
    if (!canAccessFeature(req, feature)) {
      res.status(403).json({ error: 'Feature not allowed' });
      return;
    }
    next();
  };
}

/** Same idea, for menus. */
export function menuScope(
  req: AuthRequest,
  field: string = 'id',
): Record<string, unknown> {
  if (!req.subAccountId) return {};
  const allowed = req.allowedMenuIds || [];
  if (allowed.length === 0) return {};
  return { [field]: { in: allowed } };
}
