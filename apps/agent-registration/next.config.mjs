import { withSentryConfig } from '@sentry/nextjs';

/**
 * Full production image build (Fly Docker, release CI):
 *   CI=true NEXT_OUTPUT_STANDALONE=true pnpm run build:ci
 *
 * Local / monorepo `pnpm build` uses `build` only — skips standalone output tracing
 * and Sentry webpack plugin work for much faster feedback.
 */
const isProductionDeployBuild =
  process.env.CI === 'true' && process.env.NEXT_OUTPUT_STANDALONE === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@microbima/portal-pin'],
  ...(isProductionDeployBuild && { output: 'standalone' }),
  eslint: {
    ignoreDuringBuilds: !isProductionDeployBuild,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/default',
        permanent: false,
      },
    ];
  },
  env: {
    CUSTOM_PORT: process.env.CUSTOM_PORT ?? '3001',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'omoybijuposydptkyohn.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'xmkiddtkujaparakqwem.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

function extractSentryInfo() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return { org: undefined, project: undefined };
  }

  try {
    const url = new URL(dsn);
    const hostname = url.hostname;
    const projectId = url.pathname.replace('/', '');
    const org = hostname.split('.')[0];
    return { org, project: projectId };
  } catch {
    console.warn('Failed to parse Sentry DSN, using fallback values');
    return { org: undefined, project: undefined };
  }
}

const { org, project } = extractSentryInfo();

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG ?? org,
  project: process.env.SENTRY_PROJECT ?? project,
  silent: !process.env.CI,
  disable: !isProductionDeployBuild,
};

const sentryOptions = {
  widenClientFileUpload: isProductionDeployBuild,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default isProductionDeployBuild
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryOptions)
  : nextConfig;
