import * as Sentry from '@sentry/nextjs';

export async function register() {
  Sentry.init({
    // Adjust this sample rate in production as needed.
    //
    // The following options are recommended for production environments:
    //   tracesSampleRate: 0.1,
    //   replaysOnErrorSampleRate: 1.0,
    //   replaysSessionSampleRate: 0.1,
    //
    // See the Sentry Next.js SDK documentation for more information:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/

    // dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

    // // App-wide config
    // environment: process.env.SENTRY_ENVIRONMENT || "development",
    // tracesSampleRate: 1.0,
    // profilesSampleRate: 1.0,
    // replaysSessionSampleRate: 0.1,
    // replaysOnErrorSampleRate: 1.0,
  });
}

export async function onRequestError(
  err: unknown,
  request: Request & { path?: string },
  context: unknown
) {
  await Sentry.captureRequestError(
    err,
    request as unknown as Parameters<typeof Sentry.captureRequestError>[1],
    context as Parameters<typeof Sentry.captureRequestError>[2]
  );
}
