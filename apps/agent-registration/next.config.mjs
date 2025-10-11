import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Don't fail build on ESLint errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Don't fail build on TypeScript errors
    ignoreBuildErrors: false,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
  // Configure for agent registration app
  env: {
    CUSTOM_PORT: process.env.CUSTOM_PORT ?? '3001',
  },
}

// Extract org and project from DSN if not provided separately
function extractSentryInfo() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  
  if (!dsn) {
    return { org: undefined, project: undefined };
  }

  try {
    // DSN format: https://[key]@[org].ingest.sentry.io/[project-id]
    const url = new URL(dsn);
    const hostname = url.hostname;
    const projectId = url.pathname.replace('/', '');
    
    // Extract org from hostname (e.g., "org.ingest.sentry.io" -> "org")
    const org = hostname.split('.')[0];
    
    return { org, project: projectId };
  } catch (error) {
    console.warn('Failed to parse Sentry DSN, using fallback values');
    return { org: undefined, project: undefined };
  }
}

const { org, project } = extractSentryInfo();

// Sentry configuration
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, configFile, stripPrefix, urlPrefix, include, ignore

  org: process.env.SENTRY_ORG ?? org,
  project: process.env.SENTRY_PROJECT ?? project,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
};

// Sentry configuration for Next.js
const sentryOptions = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryOptions);
