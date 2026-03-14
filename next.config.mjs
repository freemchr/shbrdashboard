/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during build (we'll lint separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript build errors for rapid iteration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
