import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { config } from '../config/env';
import { AppError, FieldValidationError } from '../middlewares/errorHandler';
import { UserRoleInfo } from '../middlewares/auth.middleware';

// In-memory store for OTP reference codes & active refresh tokens (cloud free-tier compatible)
const otpRefCodeStore = new Map<string, { refCode: string; expiresAt: number }>();
const refreshTokenStore = new Map<string, { userId: number; expiresAt: number }>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{9,15}$/;

function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/i.exec(duration.trim());
  if (!match) return 900; // default 15m
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 900;
  }
}

function generateSixDigitOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateRefCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function formatUserRoles(
  userRoles: Array<{ role: { id: number; name: string } }>,
  isBecomeToHost: boolean
): UserRoleInfo[] {
  const roles = userRoles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
  }));
  if (roles.length === 0) {
    roles.push({
      id: isBecomeToHost ? 2 : 1,
      name: isBecomeToHost ? 'host' : 'guest',
    });
  }
  return roles;
}

function issueTokens(user: {
  id: number;
  email: string;
  isBecomeToHost: boolean;
  userRoles: Array<{ role: { id: number; name: string } }>;
}) {
  const roles = formatUserRoles(user.userRoles, user.isBecomeToHost);
  const primaryRole =
    roles.find((r) => r.name.toLowerCase() === 'admin') ||
    roles.find((r) => r.name.toLowerCase() === 'host') ||
    roles[0];

  const accessPayload = {
    userId: user.id,
    email: user.email,
    roleId: primaryRole.id,
    roleName: primaryRole.name,
    roles,
    type: 'access',
  };

  const refreshPayload = {
    userId: user.id,
    email: user.email,
    jti: crypto.randomUUID(),
    type: 'refresh',
  };

  const accessOptions: SignOptions = {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  };

  const refreshOptions: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(accessPayload, config.jwt.secret, accessOptions);
  const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, refreshOptions);
  const expiresIn = parseDurationToSeconds(config.jwt.expiresIn);
  const refreshExpiresSeconds = parseDurationToSeconds(config.jwt.refreshExpiresIn);

  refreshTokenStore.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + refreshExpiresSeconds * 1000,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: 'Bearer',
    roles,
  };
}

/**
 * POST /api/v1/auth/sign-up
 */
export async function signUp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      email,
      password,
      confirmPassword,
      firstname,
      lastname,
      firstName: bodyFirstName,
      lastName: bodyLastName,
      phone,
    } = req.body || {};

    const resolvedFirstName =
      typeof firstname === 'string' && firstname.trim()
        ? firstname.trim()
        : typeof bodyFirstName === 'string' && bodyFirstName.trim()
        ? bodyFirstName.trim()
        : '';

    const resolvedLastName =
      typeof lastname === 'string' && lastname.trim()
        ? lastname.trim()
        : typeof bodyLastName === 'string' && bodyLastName.trim()
        ? bodyLastName.trim()
        : '';

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPhone =
      typeof phone === 'string' ? phone.trim().replace(/[-\s]/g, '') : '';

    const validationErrors: FieldValidationError[] = [];

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      validationErrors.push({
        field: 'email',
        tag: 'email',
        value: String(email ?? ''),
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      validationErrors.push({
        field: 'password',
        tag: 'min',
        value: '',
      });
    }

    if (!normalizedPhone || !PHONE_REGEX.test(normalizedPhone)) {
      validationErrors.push({
        field: 'phone',
        tag: 'phone',
        value: String(phone ?? ''),
      });
    }

    if (!resolvedFirstName) {
      validationErrors.push({
        field: 'firstname',
        tag: 'required',
        value: '',
      });
    }

    if (!resolvedLastName) {
      validationErrors.push({
        field: 'lastname',
        tag: 'required',
        value: '',
      });
    }

    if (
      confirmPassword !== undefined &&
      typeof password === 'string' &&
      password !== confirmPassword
    ) {
      validationErrors.push({
        field: 'confirmPassword',
        tag: 'match',
        value: '',
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    // Check duplicate email
    const existingEmailUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (existingEmailUser) {
      throw new AppError('Email is already in used.', 409, 'A-3003');
    }

    // Check duplicate phone
    const existingPhoneUser = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
      },
    });

    if (existingPhoneUser) {
      throw new AppError('Phone number already exists.', 409, 'A-3004');
    }

    // Ensure default 'guest' role exists
    const guestRole = await prisma.role.upsert({
      where: { name: 'guest' },
      update: {},
      create: {
        name: 'guest',
        label: 'ผู้ใช้ทั่วไป / ผู้ฝากเลี้ยง',
        description: 'Guest / Pet Owner role',
      },
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateSixDigitOtp();
    const refCode = generateRefCode();
    const otpExpiredAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const createdUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        phone: normalizedPhone,
        password: hashedPassword,
        otp,
        otpExpiredAt,
        isVerified: false,
        userRoles: {
          create: {
            roleId: guestRole.id,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    otpRefCodeStore.set(normalizedEmail, {
      refCode,
      expiresAt: otpExpiredAt.getTime(),
    });

    res.status(201).json({
      code: 'S-0000',
      message: 'User registered successfully. Please verify OTP.',
      refCode,
      ...(config.env !== 'production' ? { otp } : {}),
      data: {
        id: createdUser.id,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        phone: createdUser.phone,
        refCode,
        ...(config.env !== 'production' ? { otp } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/verify-otp
 */
export async function verifyOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, otp } = req.body || {};
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedOtp = typeof otp === 'string' ? otp.trim() : String(otp ?? '').trim();

    const validationErrors: FieldValidationError[] = [];
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      validationErrors.push({
        field: 'email',
        tag: 'email',
        value: String(email ?? ''),
      });
    }
    if (!normalizedOtp || normalizedOtp.length !== 6) {
      validationErrors.push({
        field: 'otp',
        tag: 'required',
        value: normalizedOtp,
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('This email is not registered.', 404, 'DB-1002');
    }

    if (
      !user.otp ||
      user.otp !== normalizedOtp ||
      (user.otpExpiredAt && user.otpExpiredAt < new Date())
    ) {
      throw new AppError('Invalid or expired OTP.', 400, 'A-3006');
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpiredAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    otpRefCodeStore.delete(normalizedEmail);

    const { accessToken, refreshToken, expiresIn, tokenType, roles } =
      issueTokens(updatedUser);

    const userPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName || '',
      lastName: updatedUser.lastName || '',
      avatar: updatedUser.avatar || '',
      isVerifiedHost: updatedUser.isVerifiedHost,
      role: roles,
    };

    res.status(200).json({
      code: 200,
      message: 'OTP verified successfully',
      accessToken,
      refreshToken,
      tokenType,
      expiresIn,
      user: userPayload,
      data: {
        accessToken,
        refreshToken,
        tokenType,
        expiresIn,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/resend-otp
 */
export async function resendOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body || {};
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      const errors: FieldValidationError[] = [
        { field: 'email', tag: 'email', value: String(email ?? '') },
      ];
      throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new AppError('This email is not registered.', 404, 'DB-1002');
    }

    const otp = generateSixDigitOtp();
    const refCode = generateRefCode();
    const otpExpiredAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpiredAt,
      },
    });

    otpRefCodeStore.set(normalizedEmail, {
      refCode,
      expiresAt: otpExpiredAt.getTime(),
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'OTP resent successfully',
      refCode,
      ...(config.env !== 'production' ? { otp } : {}),
      data: {
        refCode,
        ...(config.env !== 'production' ? { otp } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/sign-in
 */
export async function signIn(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    const validationErrors: FieldValidationError[] = [];
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      validationErrors.push({
        field: 'email',
        tag: 'email',
        value: String(email ?? ''),
      });
    }
    if (!password || typeof password !== 'string') {
      validationErrors.push({
        field: 'password',
        tag: 'required',
        value: '',
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'A-3001');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401, 'A-3001');
    }

    if (user.bannedAt !== null) {
      throw new AppError('User account has been banned.', 403, 'A-3002');
    }

    // Touch user updated_at to reflect recent sign-in
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    const { accessToken, refreshToken, expiresIn, tokenType, roles } =
      issueTokens(user);

    const userPayload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatar: user.avatar || '',
      isVerifiedHost: user.isVerifiedHost,
      role: roles,
    };

    res.status(200).json({
      code: 200,
      message: 'Sign in successful',
      accessToken,
      refreshToken,
      tokenType,
      expiresIn,
      user: userPayload,
      data: {
        accessToken,
        refreshToken,
        tokenType,
        expiresIn,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/refresh-token
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken: token } = req.body || {};

    if (!token || typeof token !== 'string') {
      throw new AppError('Refresh token is required.', 401, 'A-3005');
    }

    let decoded: { userId?: number; email?: string; type?: string };
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret) as {
        userId?: number;
        email?: string;
        type?: string;
      };
    } catch (_err) {
      throw new AppError('Invalid or expired refresh token.', 401, 'A-3005');
    }

    if (!decoded || typeof decoded.userId !== 'number') {
      throw new AppError('Invalid refresh token payload.', 401, 'A-3005');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new AppError('User account not found.', 401, 'A-3005');
    }

    if (user.bannedAt !== null) {
      throw new AppError('User account has been banned.', 403, 'A-3002');
    }

    const issued = issueTokens(user);

    res.status(200).json({
      code: 'S-0000',
      message: 'Token refreshed successfully',
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      tokenType: issued.tokenType,
      expiresIn: issued.expiresIn,
      data: {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body || {};
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      const errors: FieldValidationError[] = [
        { field: 'email', tag: 'email', value: String(email ?? '') },
      ];
      throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new AppError('This email is not registered.', 404, 'DB-1002');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpiredAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiredAt,
      },
    });

    const payload = Buffer.from(
      JSON.stringify({
        email: user.email,
        resetPasswordToken: resetToken,
      })
    ).toString('base64');

    res.status(200).json({
      code: 'S-0000',
      message: 'Password reset link sent',
      resetPasswordToken: resetToken,
      payload,
      data: {
        resetPasswordToken: resetToken,
        payload,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/reset-password
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, confirmPassword, resetPasswordToken } =
      req.body || {};

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    const validationErrors: FieldValidationError[] = [];

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      validationErrors.push({
        field: 'email',
        tag: 'email',
        value: String(email ?? ''),
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      validationErrors.push({
        field: 'password',
        tag: 'min',
        value: '',
      });
    }

    if (
      confirmPassword !== undefined &&
      typeof password === 'string' &&
      password !== confirmPassword
    ) {
      validationErrors.push({
        field: 'confirmPassword',
        tag: 'match',
        value: '',
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    if (!resetPasswordToken || typeof resetPasswordToken !== 'string') {
      throw new AppError(
        'Reset password token already used.',
        400,
        'A-3010'
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    });

    if (
      !user ||
      !user.resetPasswordToken ||
      user.resetPasswordToken !== resetPasswordToken ||
      (user.resetPasswordExpiredAt && user.resetPasswordExpiredAt < new Date())
    ) {
      throw new AppError(
        'Reset password token already used.',
        400,
        'A-3010'
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiredAt: null,
      },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/auth/profile
 */
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new AppError('User not found.', 404, 'DB-1002');
    }

    // Calculate unbanAllPropertiesRequestCount and hasPendingUnbanAllPropertiesRequest
    const unbanAllReports = await prisma.report.findMany({
      where: {
        reporterId: user.id,
        propertyId: null,
        deletedAt: null,
        reportCategory: {
          type: 'unban_property',
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const unbanAllPropertiesRequestCount = unbanAllReports.length;
    const hasPendingUnbanAllPropertiesRequest = unbanAllReports.some(
      (r) => r.status === 'pending'
    );

    const roles = formatUserRoles(user.userRoles, user.isBecomeToHost);

    const profileData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatar: user.avatar || '',
      phone: user.phone || '',
      isVerified: user.isVerified,
      isBecomeToHost: user.isBecomeToHost,
      isVerifiedHost: user.isVerifiedHost,
      isBannedReview: user.isBannedReview,
      isBannedAllProperties: user.isBannedAllProperties,
      unbanAllPropertiesRequestCount,
      hasPendingUnbanAllPropertiesRequest,
      role: roles,
    };

    res.status(200).json({
      code: 200,
      message: 'Success',
      data: profileData,
      profile: profileData,
      user: profileData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:userId/change-password
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) {
      throw new AppError('Invalid user ID.', 400, 'T-2007');
    }

    const isAdmin = req.user.roles.some(
      (r) => r.name.toLowerCase() === 'admin'
    );
    if (req.user.id !== targetUserId && !isAdmin) {
      throw new AppError(
        'Access forbidden. Cannot change another user password.',
        403,
        'A-3007'
      );
    }

    const { oldPassword, newPassword, confirmPassword } = req.body || {};

    const validationErrors: FieldValidationError[] = [];

    if (!oldPassword || typeof oldPassword !== 'string') {
      validationErrors.push({
        field: 'oldPassword',
        tag: 'required',
        value: '',
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      validationErrors.push({
        field: 'newPassword',
        tag: 'min',
        value: '',
      });
    }

    if (
      confirmPassword !== undefined &&
      typeof newPassword === 'string' &&
      newPassword !== confirmPassword
    ) {
      validationErrors.push({
        field: 'confirmPassword',
        tag: 'match',
        value: '',
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user || user.deletedAt !== null) {
      throw new AppError('User not found.', 404, 'DB-1002');
    }

    const isOldPasswordCorrect = await bcrypt.compare(
      oldPassword,
      user.password
    );
    if (!isOldPasswordCorrect) {
      throw new AppError('Wrong password.', 400, 'A-3011');
    }

    const isSameAsOld =
      newPassword === oldPassword ||
      (await bcrypt.compare(newPassword, user.password));
    if (isSameAsOld) {
      throw new AppError('New password same as old password.', 400, 'A-3012');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
      },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
}
