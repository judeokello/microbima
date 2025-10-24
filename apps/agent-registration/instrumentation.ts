import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  serverName: "agent-registration", // Identify this as agent-registration service
  
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  
  // Set profilesSampleRate to 1.0 to profile 100%
  // of sampled transactions.
  // This is relative to tracesSampleRate
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0'),
  
  // Adjust this value in production, or use tracesSampler for greater control
  // tracesSampler: (samplingContext) => { ... }
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.SENTRY_ENVIRONMENT === 'development',
});
