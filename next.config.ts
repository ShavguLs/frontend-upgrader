import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.steamstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.akamai.steamstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "steamcommunity-a.akamaihd.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.waxpeer.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
