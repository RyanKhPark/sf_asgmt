function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue = ""): string {
  return process.env[name] || defaultValue;
}

export const env = {
  NEXTAUTH_URL: getRequiredEnvVar("NEXTAUTH_URL"),
  NEXTAUTH_SECRET: getRequiredEnvVar("NEXTAUTH_SECRET"),
  GOOGLE_CLIENT_ID: getOptionalEnvVar("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: getOptionalEnvVar("GOOGLE_CLIENT_SECRET"),
  DATABASE_URL: getRequiredEnvVar("DATABASE_URL"),
} as const;

// Validate auth setup
export function validateAuthConfig(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️  Google OAuth not configured - Google sign-in will not work");
  }

  if (!env.DATABASE_URL.startsWith("postgresql://")) {
    console.warn("⚠️  DATABASE_URL should start with 'postgresql://' for PostgreSQL");
  }

  console.log("✅ Environment variables validated");
}