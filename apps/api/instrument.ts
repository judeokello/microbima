import * as dotenv from "dotenv";
import * as path from "path";

// Try to import Sentry, but don't fail if it's not available
let Sentry: any = null;
try {
  Sentry = require("@sentry/nestjs");
} catch (error) {
  console.log("⚠️  Sentry not available, skipping initialization");
}

// Load environment variables from .env file in project root
// Try multiple possible paths
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    console.log(`✅ Environment loaded from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env file found, using system environment variables');
}

// Ensure to call this before requiring any other modules!
const sentryConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || "development",
  
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/nestjs/configuration/options/#tracesSampleRate
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0"),
  
  // Set profilesSampleRate to 1.0 to profile 100%
  // of sampled transactions.
  // This is relative to tracesSampleRate
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/nestjs/configuration/options/#profilesSampleRate
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "1.0"),
};

if (Sentry) {
  console.log('🔧 Sentry Configuration:', {
    dsn: sentryConfig.dsn ? 'Set' : 'Not set',
    environment: sentryConfig.environment,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    profilesSampleRate: sentryConfig.profilesSampleRate,
  });

  Sentry.init(sentryConfig);
  console.log('✅ Sentry initialized successfully');
} else {
  console.log('⚠️  Sentry not available, skipping initialization');
}
