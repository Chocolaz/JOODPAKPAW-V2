import dotenv from 'dotenv';
import path from 'path';

// Load .env file from root of API
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://joodpakpaw:joodpakpaw_password@localhost:5432/joodpakpaw_db?schema=public',
  redisUrl: process.env.REDIS_URL || '',
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadminpassword',
    bucket: process.env.S3_BUCKET || 'joodpakpaw-media',
    publicUrl: process.env.S3_PUBLIC_URL || 'http://localhost:9000/joodpakpaw-media',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'joodpakpaw_super_secret_jwt_key_2026_dev',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'joodpakpaw_super_secret_refresh_jwt_key_2026_dev',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  mlTimeoutMs: parseInt(process.env.ML_TIMEOUT_MS || '1500', 10),
};
