import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Separate output allows validation alongside an existing development server.
  distDir: process.env.MEET_BUILD_DIR || '.next',
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  images: {
    remotePatterns: [
      {
        hostname: 'cdn.tailgrids.com',
      },
      {
        hostname: 'www.gstatic.com',
      },
      {
        hostname: 'img.clerk.com',
      },
    ],
  },
};

export default nextConfig;
