import type { NextConfig } from 'next'

const config: NextConfig = {
  // React Compiler is enabled by default in Next.js 16.
  transpilePackages: [
    '@meal-planner/ai',
    '@meal-planner/db',
    '@meal-planner/domain',
    '@meal-planner/shared',
    '@meal-planner/ui',
  ],
}

export default config
