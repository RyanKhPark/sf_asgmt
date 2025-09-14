/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude test files from pdf-parse
    config.externals = config.externals || [];

    if (isServer) {
      config.externals.push({
        'canvas': 'canvas',
      });
    }

    // Ignore test files
    config.module.rules.push({
      test: /\.pdf$/,
      type: 'asset/resource',
    });

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

module.exports = nextConfig;