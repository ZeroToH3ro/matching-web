/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,

  // Configure external image domains
  images: {
    // Enable SVG support for avatar services like dicebear
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'aggregator.walrus-testnet.walrus.space',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'wal-aggregator-testnet.staketab.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'walrus-testnet-aggregator.redundex.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'walrus-testnet-aggregator.nodes.guru',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'aggregator.walrus.banansen.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'walrus-testnet-aggregator.everstake.one',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Configure webpack to handle WASM files
  webpack: (config, { isServer, dev }) => {
    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: isServer ? '../static/wasm/[name][ext]' : 'static/wasm/[name][ext]',
      },
    });

    // Client-side fallbacks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://verify.walletconnect.com https://verify.walletconnect.org",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: ws:",
              "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org",
              "frame-ancestors 'self' https://farcaster.xyz https://*.farcaster.xyz https://warpcast.com https://*.warpcast.com"
            ].join('; ')
          }
        ]
      }
    ];
  },

  async rewrites() {
    return [
      // Walrus publisher proxies
      {
        source: '/publisher1/v1/:path*',
        destination: 'https://publisher.walrus-testnet.walrus.space/v1/:path*',
      },
      {
        source: '/publisher2/v1/:path*',
        destination: 'https://wal-publisher-testnet.staketab.org/v1/:path*',
      },
      {
        source: '/publisher3/v1/:path*',
        destination: 'https://walrus-testnet-publisher.redundex.com/v1/:path*',
      },
      {
        source: '/publisher4/v1/:path*',
        destination: 'https://walrus-testnet-publisher.nodes.guru/v1/:path*',
      },
      {
        source: '/publisher5/v1/:path*',
        destination: 'https://publisher.walrus.banansen.dev/v1/:path*',
      },
      {
        source: '/publisher6/v1/:path*',
        destination: 'https://walrus-testnet-publisher.everstake.one/v1/:path*',
      },
      // Walrus aggregator proxies
      {
        source: '/aggregator1/v1/:path*',
        destination: 'https://aggregator.walrus-testnet.walrus.space/v1/:path*',
      },
      {
        source: '/aggregator2/v1/:path*',
        destination: 'https://wal-aggregator-testnet.staketab.org/v1/:path*',
      },
      {
        source: '/aggregator3/v1/:path*',
        destination: 'https://walrus-testnet-aggregator.redundex.com/v1/:path*',
      },
      {
        source: '/aggregator4/v1/:path*',
        destination: 'https://walrus-testnet-aggregator.nodes.guru/v1/:path*',
      },
      {
        source: '/aggregator5/v1/:path*',
        destination: 'https://aggregator.walrus.banansen.dev/v1/:path*',
      },
      {
        source: '/aggregator6/v1/:path*',
        destination: 'https://walrus-testnet-aggregator.everstake.one/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
