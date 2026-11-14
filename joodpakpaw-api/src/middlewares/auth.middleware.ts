import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';

type UserWithRoles = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: true } } };
}>;

export interface UserRoleInfo {
  id: number;
  name: string;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  roleId: number;
  roleName: string;
  roles: UserRoleInfo[];
  isVerified: boolean;
  isBecomeToHost: boolean;
  isVerifiedHost: boolean;
  isBannedAllProperties: boolean;
  isBannedReview: boolean;
}

export interface JwtAccessPayload {
  userId: number;
  email: string;
  roleId?: number;
  roleName?: string;
  roles?: UserRoleInfo[];
  type?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function resolvePrimaryRole(roles: UserRoleInfo[], isBecomeToHost: boolean): UserRoleInfo {
  const adminRole = roles.find((r) => r.name.toLowerCase() === 'admin');
  if (adminRole) return adminRole;

  const hostRole = roles.find((r) => r.name.toLowerCase() === 'host');
  if (hostRole) return hostRole;

  if (roles.length > 0) {
    return roles[0];
  }

  return {
    id: isBecomeToHost ? 2 : 1,
    name: isBecomeToHost ? 'host' : 'guest',
  };
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return null;
  }
  return parts[1];
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        code: 'A-3005',
        message: 'Authentication required. Missing Bearer token.',
        error: {
          code: 'A-3005',
          message: 'Authentication required. Missing Bearer token.',
        },
      });
      return;
    }

    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JwtAccessPayload;
    } catch (_err) {
      res.status(401).json({
        success: false,
        code: 'A-3005',
        message: 'Invalid or expired access token.',
        error: {
          code: 'A-3005',
          message: 'Invalid or expired access token.',
        },
      });
      return;
    }

    if (!decoded || typeof decoded.userId !== 'number') {
      res.status(401).json({
        success: false,
        code: 'A-3005',
        message: 'Invalid token payload.',
        error: {
          code: 'A-3005',
          message: 'Invalid token payload.',
        },
      });
      return;
    }

    let user: UserWithRoles | null = null;

    let attempts = 0;
    while (attempts < 2) {
      try {
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        });
        break;
      } catch (err) {
        attempts++;
        if (attempts >= 2) throw err;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    if (!user || user.deletedAt !== null) {
      res.status(401).json({
        success: false,
        code: 'A-3005',
        message: 'User account not found or has been deactivated.',
        error: {
          code: 'A-3005',
          message: 'User account not found or has been deactivated.',
        },
      });
      return;
    }

    if (user.bannedAt !== null) {
      res.status(403).json({
        success: false,
        code: 'A-3002',
        message: 'User account has been banned.',
        error: {
          code: 'A-3002',
          message: 'User account has been banned.',
        },
      });
      return;
    }

    const roles: UserRoleInfo[] = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    }));

    const primaryRole = resolvePrimaryRole(roles, user.isBecomeToHost);
    if (roles.length === 0) {
      roles.push(primaryRole);
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: primaryRole.id,
      roleName: primaryRole.name,
      roles,
      isVerified: user.isVerified,
      isBecomeToHost: user.isBecomeToHost,
      isVerifiedHost: user.isVerifiedHost,
      isBannedAllProperties: user.isBannedAllProperties,
      isBannedReview: user.isBannedReview,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }

    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JwtAccessPayload;
    } catch (_err) {
      next();
      return;
    }

    if (!decoded || typeof decoded.userId !== 'number') {
      next();
      return;
    }

    let user: UserWithRoles | null = null;

    let attempts = 0;
    while (attempts < 2) {
      try {
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        });
        break;
      } catch (_err) {
        attempts++;
        if (attempts >= 2) {
          next();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    if (!user || user.deletedAt !== null || user.bannedAt !== null) {
      next();
      return;
    }

    const roles: UserRoleInfo[] = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    }));

    const primaryRole = resolvePrimaryRole(roles, user.isBecomeToHost);
    if (roles.length === 0) {
      roles.push(primaryRole);
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: primaryRole.id,
      roleName: primaryRole.name,
      roles,
      isVerified: user.isVerified,
      isBecomeToHost: user.isBecomeToHost,
      isVerifiedHost: user.isVerifiedHost,
      isBannedAllProperties: user.isBannedAllProperties,
      isBannedReview: user.isBannedReview,
    };

    next();
  } catch (_err) {
    next();
  }
}

export function requireRoles(...allowedRoles: string[]) {
  const normalizedAllowed = new Set<string>();
  for (const r of allowedRoles) {
    const lower = r.toLowerCase();
    normalizedAllowed.add(lower);
    if (lower === 'user' || lower === 'guest') {
      normalizedAllowed.add('user');
      normalizedAllowed.add('guest');
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        code: 'A-3005',
        message: 'Authentication required.',
        error: {
          code: 'A-3005',
          message: 'Authentication required.',
        },
      });
      return;
    }

    const userRoleNames = new Set<string>(
      req.user.roles.map((r) => r.name.toLowerCase())
    );
    userRoleNames.add(req.user.roleName.toLowerCase());
    if (userRoleNames.has('guest') || userRoleNames.has('user')) {
      userRoleNames.add('guest');
      userRoleNames.add('user');
    }
    if (req.user.isBecomeToHost) {
      userRoleNames.add('host');
    }

    const hasRole = Array.from(normalizedAllowed).some((allowed) =>
      userRoleNames.has(allowed)
    );

    if (!hasRole) {
      res.status(403).json({
        success: false,
        code: 'A-3007',
        message: 'Access forbidden. Insufficient permissions.',
        error: {
          code: 'A-3007',
          message: 'Access forbidden. Insufficient permissions.',
        },
      });
      return;
    }

    next();
  };
}
