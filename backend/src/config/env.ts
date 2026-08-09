import dotenv from 'dotenv';
dotenv.config();

interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  geminiApiKey: string;
  aiProvider: 'gemini' | 'demo';
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  frontendUrl: string;
}

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    console.warn(`Warning: Environment variable ${key} is not set`);
    return '';
  }
  return value;
}

export const config: Config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '3001'), 10),
  databaseUrl: getEnv('DATABASE_URL', ''),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
  geminiApiKey: getEnv('GEMINI_API_KEY', ''),
  aiProvider: (getEnv('AI_PROVIDER', 'demo') as 'gemini' | 'demo'),
  cloudinary: {
    cloudName: getEnv('CLOUDINARY_CLOUD_NAME', ''),
    apiKey: getEnv('CLOUDINARY_API_KEY', ''),
    apiSecret: getEnv('CLOUDINARY_API_SECRET', ''),
  },
  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3000'),
};

export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

export function isDemoMode(): boolean {
  return config.aiProvider === 'demo' || !config.geminiApiKey;
}
