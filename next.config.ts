import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  // /build was the first storefront editor. Old links land in the workspace; a ?prompt= link goes to Axori AI with it.
  async redirects() {
    return [
      { source: "/build", has: [{ type: "query", key: "prompt" }], destination: "/dashboard/ai", permanent: false },
      { source: "/build/:path*", destination: "/dashboard", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
