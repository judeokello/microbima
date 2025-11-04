import * as Sentry from '@sentry/nextjs';

console.log('🔍 Client Sentry Config Debug:');
console.log('NEXT_PUBLIC_SENTRY_DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN);
console.log('NEXT_PUBLIC_SENTRY_ENVIRONMENT:', process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT || 'development',
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

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Export navigation hook for Next.js router instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
