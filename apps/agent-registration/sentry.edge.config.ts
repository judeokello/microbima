import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  serverName: "agent-registration", // Identify this as agent-registration service
  
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.SENTRY_ENVIRONMENT === 'development',
});
