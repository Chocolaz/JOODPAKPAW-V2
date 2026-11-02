import type { NextConfig } from 'next'
import type { RuleSetRule } from 'webpack'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/capstone25/cp25nk2'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH + '/',
  trailingSlash: true,

  images: {
    remotePatterns: [
      { hostname: 'cp25nk2.sit.kmutt.ac.th' },
      { hostname: 'bscit.sit.kmutt.ac.th' },
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
