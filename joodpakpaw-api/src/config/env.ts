import dotenv from 'dotenv';
import path from 'path';

// Load .env file from root of API
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const DEFAULT_JWT_SECRET = 'joodpakpaw_super_secret_jwt_key_2026_dev';
export const DEFAULT_JWT_REFRESH_SECRET =
  'joodpakpaw_super_secret_refresh_jwt_key_2026_dev';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  email: {
    resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
    from: (process.env.EMAIL_FROM || 'JoodPakPaw <no-reply@joodpakpaw.com>').trim(),
  },
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://joodpakpaw:joodpakpaw_password@localhost:5432/joodpakpaw_db?schema=public',
  redisUrl: process.env.REDIS_URL || '',
  supabase: {
    url: process.env.SUPABASE_URL || 'https://axvgqarpeifqvyjfccxo.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadminpassword',
    bucket: process.env.S3_BUCKET || 'joodpakpaw-media',
    publicUrl:
      process.env.S3_PUBLIC_URL ||
      'https://axvgqarpeifqvyjfccxo.supabase.co/storage/v1/object/public/joodpakpaw-media',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || DEFAULT_JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  mlTimeoutMs: parseInt(process.env.ML_TIMEOUT_MS || '1500', 10),
};

export interface ProductionSecretsConfig {
  env: string;
  jwt: {
    secret: string;
    refreshSecret: string;
  };
}

/**
 * Fail-fast guard for production deployments: refuses to boot when JWT secrets
 * are missing or left on the hardcoded development defaults.
 * Never throws in development or test environments.
 */
export function assertProductionSecrets(
  envConfig: ProductionSecretsConfig = config
): void {
  if (envConfig.env !== 'production') {
    return;
  }

  const secret = (envConfig.jwt?.secret || '').trim();
  const refreshSecret = (envConfig.jwt?.refreshSecret || '').trim();

  if (!secret || secret === DEFAULT_JWT_SECRET) {
    throw new Error(
      '[Security] Fatal: JWT_SECRET must be set to a strong non-default value in production.'
    );
  }

  if (!refreshSecret || refreshSecret === DEFAULT_JWT_REFRESH_SECRET) {
    throw new Error(
      '[Security] Fatal: JWT_REFRESH_SECRET must be set to a strong non-default value in production.'
    );
  }
}

assertProductionSecrets(config);
