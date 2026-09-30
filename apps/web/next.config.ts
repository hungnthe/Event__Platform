import type { NextConfig } from 'next';

// `standalone` is required by the production Docker image, but Next copies its
// trace with Windows symlinks in that mode. Keep the portable local build free
// of that platform-specific requirement and enable it explicitly in Docker.
const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true' ? { output: 'standalone' as const } : {}),
  poweredByHeader: false,
  experimental: { cpus: 1 },
};

export default nextConfig;
