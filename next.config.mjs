/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The DB connection uses the `postgres` package on the server only.
    // Keep it external so Next doesn't try to bundle it.
    serverComponentsExternalPackages: ["postgres"],
  },
};

export default nextConfig;
