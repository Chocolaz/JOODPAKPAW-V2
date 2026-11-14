import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { config } from '../config/env';
import { AppError, FieldValidationError } from '../middlewares/errorHandler';
import { UserRoleInfo } from '../middlewares/auth.middleware';
import { uploadImageAsWebp, deleteObjectFromS3 } from '../services/storage.service';

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
        value: '[REDACTED]',
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
        field: 'firstName',
        tag: 'required',
        value: '',
      });
    }

    if (!resolvedLastName) {
      validationErrors.push({
        field: 'lastName',
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
        value: '[REDACTED]',
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
      data: {
        id: createdUser.id,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        phone: createdUser.phone,
        refCode,
        ...(config.env !== 'production' ? { otp, debugOtp: otp } : {}),
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
      code: 'S-0000',
      message: 'OTP verified successfully',
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

    if (user.isVerified) {
      throw new AppError(
        'Email is already verified. Please sign in instead.',
        400,
        'A-3008'
      );
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
      data: {
        refCode,
        ...(config.env !== 'production' ? { otp, debugOtp: otp } : {}),
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

    if (!user.isVerified) {
      throw new AppError(
        'Email not verified. Please verify your email with OTP first.',
        403,
        'A-3006',
        { email: user.email }
      );
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
      code: 'S-0000',
      message: 'Sign in successful',
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
      data: {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        tokenType: issued.tokenType,
        expiresIn: issued.expiresIn,
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

    const isSameAsCurrent = await bcrypt.compare(password, user.password);
    if (isSameAsCurrent) {
      throw new AppError(
        'New password cannot be the same as your current password.',
        400,
        'A-3012'
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
      data: null,
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
      code: 'S-0000',
      message: 'Success',
      data: profileData,
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

    let targetUserId: number;
    if (req.params.userId === 'me' || !req.params.userId) {
      targetUserId = req.user.id;
    } else {
      targetUserId = parseInt(req.params.userId, 10);
      if (isNaN(targetUserId)) {
        throw new AppError('Invalid user ID.', 400, 'T-2007');
      }
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

    // Invalidate all active refresh tokens for this user
    for (const [t, entry] of refreshTokenStore.entries()) {
      if (entry.userId === user.id) {
        refreshTokenStore.delete(t);
      }
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Password changed successfully.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to extract an uploaded image file from req.file or req.files
 */
function extractUploadedAvatarFile(req: Request): Express.Multer.File | undefined {
  if (req.file) {
    return req.file;
  }
  if (Array.isArray(req.files) && req.files.length > 0) {
    const preferred = req.files.find((f) =>
      ['avatar', 'image', 'profileImage', 'file'].includes(f.fieldname)
    );
    return preferred || req.files[0];
  }
  if (req.files && typeof req.files === 'object') {
    const filesMap = req.files as Record<string, Express.Multer.File[]>;
    for (const key of ['avatar', 'image', 'profileImage', 'file']) {
      if (Array.isArray(filesMap[key]) && filesMap[key].length > 0) {
        return filesMap[key][0];
      }
    }
    const firstKey = Object.keys(filesMap)[0];
    if (firstKey && Array.isArray(filesMap[firstKey]) && filesMap[firstKey].length > 0) {
      return filesMap[firstKey][0];
    }
  }
  return undefined;
}

/**
 * PUT /api/v1/users/:userId
 */
export async function updateUserProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    let targetUserId: number;
    if (req.params.userId === 'me' || !req.params.userId) {
      targetUserId = req.user.id;
    } else {
      targetUserId = parseInt(req.params.userId, 10);
      if (isNaN(targetUserId)) {
        throw new AppError('Invalid user ID.', 400, 'T-2007');
      }
    }

    const isAdmin = req.user.roles.some(
      (r) => r.name.toLowerCase() === 'admin'
    );
    if (req.user.id !== targetUserId && !isAdmin) {
      throw new AppError(
        'Access forbidden. Cannot update another user profile.',
        403,
        'A-3007'
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!existingUser || existingUser.deletedAt !== null) {
      throw new AppError('User not found.', 404, 'DB-1002');
    }

    const body = req.body || {};
    const rawFirstName =
      body.firstName !== undefined ? body.firstName : body.firstname;
    const rawLastName =
      body.lastName !== undefined ? body.lastName : body.lastname;
    const rawPhone = body.phone;

    const validationErrors: FieldValidationError[] = [];

    let updatedFirstName = existingUser.firstName;
    if (rawFirstName !== undefined) {
      const trimmed = String(rawFirstName).trim();
      if (!trimmed) {
        validationErrors.push({
          field: 'firstName',
          tag: 'required',
          value: String(rawFirstName),
        });
      } else {
        updatedFirstName = trimmed;
      }
    }

    let updatedLastName = existingUser.lastName;
    if (rawLastName !== undefined) {
      const trimmed = String(rawLastName).trim();
      if (!trimmed) {
        validationErrors.push({
          field: 'lastName',
          tag: 'required',
          value: String(rawLastName),
        });
      } else {
        updatedLastName = trimmed;
      }
    }

    let updatedPhone = existingUser.phone;
    if (rawPhone !== undefined && rawPhone !== null) {
      const normalizedPhone = String(rawPhone).trim().replace(/[-\s]/g, '');
      if (!normalizedPhone || !PHONE_REGEX.test(normalizedPhone)) {
        validationErrors.push({
          field: 'phone',
          tag: 'phone',
          value: String(rawPhone),
        });
      } else {
        updatedPhone = normalizedPhone;
      }
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

    // Check duplicate phone if phone is being changed/provided
    if (
      updatedPhone &&
      updatedPhone !== existingUser.phone
    ) {
      const duplicatePhoneUser = await prisma.user.findFirst({
        where: {
          phone: updatedPhone,
          id: { not: targetUserId },
        },
      });
      if (duplicatePhoneUser) {
        throw new AppError('Phone number already exists.', 409, 'A-3004');
      }
    } else if (rawPhone !== undefined && updatedPhone) {
      // Even if same phone, double check no other user holds it
      const duplicatePhoneUser = await prisma.user.findFirst({
        where: {
          phone: updatedPhone,
          id: { not: targetUserId },
        },
      });
      if (duplicatePhoneUser) {
        throw new AppError('Phone number already exists.', 409, 'A-3004');
      }
    }

    // Handle optional avatar image upload via Sharp WebP + S3/MinIO adapter
    let updatedAvatar = existingUser.avatar;
    const uploadedFile = extractUploadedAvatarFile(req);
    if (uploadedFile && uploadedFile.buffer) {
      if (existingUser.avatar) {
        await deleteObjectFromS3(existingUser.avatar);
      }
      updatedAvatar = await uploadImageAsWebp(
        uploadedFile.buffer,
        'avatars',
        uploadedFile.originalname
      );
    } else if (
      typeof body.avatar === 'string' &&
      body.avatar.trim().length > 0
    ) {
      updatedAvatar = body.avatar.trim();
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        firstName: updatedFirstName,
        lastName: updatedLastName,
        phone: updatedPhone,
        avatar: updatedAvatar,
        updatedAt: new Date(),
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Calculate unbanAllPropertiesRequestCount and hasPendingUnbanAllPropertiesRequest
    const unbanAllReports = await prisma.report.findMany({
      where: {
        reporterId: updatedUser.id,
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

    const roles = formatUserRoles(
      updatedUser.userRoles,
      updatedUser.isBecomeToHost
    );

    const updatedUserProfile = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName || '',
      lastName: updatedUser.lastName || '',
      avatar: updatedUser.avatar || '',
      phone: updatedUser.phone || '',
      isVerified: updatedUser.isVerified,
      isBecomeToHost: updatedUser.isBecomeToHost,
      isVerifiedHost: updatedUser.isVerifiedHost,
      isBannedReview: updatedUser.isBannedReview,
      isBannedAllProperties: updatedUser.isBannedAllProperties,
      unbanAllPropertiesRequestCount,
      hasPendingUnbanAllPropertiesRequest,
      role: roles,
    };

    res.status(200).json({
      code: 'S-0000',
      message: 'Profile updated successfully',
      data: updatedUserProfile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/sign-out
 */
export async function signOut(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const { refreshToken: token } = req.body || {};
    if (token && typeof token === 'string') {
      refreshTokenStore.delete(token);
    }

    // Invalidate all active tokens for current user
    for (const [t, entry] of refreshTokenStore.entries()) {
      if (entry.userId === req.user.id) {
        refreshTokenStore.delete(t);
      }
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Signed out successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
