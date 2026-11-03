import type { NextConfig } from 'next'
import type { RuleSetRule } from 'webpack'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  output: 'standalone',
  ...(BASE_PATH
    ? {
        basePath: BASE_PATH,
        assetPrefix: `${BASE_PATH}/`,
      }
    : {}),
  trailingSlash: true,

  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'joodpakpaw-minio' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placedog.net' },
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },

  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      (rule: RuleSetRule | '...'): rule is RuleSetRule => {
        if (
          typeof rule === 'object' &&
          rule !== null &&
          'test' in rule &&
          rule.test instanceof RegExp
        ) {
          return rule.test.test('.svg')
        }
        return false
      }
    )

    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/
    }

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /(_actions|actions-runner|node_modules)/,
      use: [],
    })

    return config
  },
}

export default nextConfig
