/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── #10 FIX: ESLint re-enabled in builds ──────────────────────────────────
  // Catches real issues; only disable temporarily if absolutely needed.
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Disable TypeScript build errors for rapid iteration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
