import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las fotos de entrega/retiro y la firma viajan como imagen reducida dentro del formulario.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
