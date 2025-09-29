/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
    CUSTOM_PORT: process.env.CUSTOM_PORT || '3001',
  },
}

export default nextConfig
