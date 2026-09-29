/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keeps the dev overlay badge out of design screenshots.
  devIndicators: false,
  // Lets a verification build (NEXT_DIST_DIR=.next-verify) run without clobbering a live dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
