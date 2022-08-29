const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const asyncWrite = promisify(fs.writeFile)
const process = require("process")

const main = async () => {
  const target = process.argv[2] || './environment.prod.ts'
  const pathToEnvFile = path.join(__dirname, target)
  const {
    BACKEND_URL,
    STRICT_LOCAL,
    MATOMO_URL,
    MATOMO_ID,
    SIIBRA_API_ENDPOINTS,
    VERSION,
    GIT_HASH = 'unknown hash',
    EXPERIMENTAL_FEATURE_FLAG,
    ENABLE_LEAP_MOTION,
  } = process.env
  
  console.log(`[parseEnv.js] parse envvar:`, {
    BACKEND_URL,
    STRICT_LOCAL,
    MATOMO_URL,
    MATOMO_ID,
    SIIBRA_API_ENDPOINTS,
    VERSION,
    GIT_HASH,
    EXPERIMENTAL_FEATURE_FLAG,
    ENABLE_LEAP_MOTION,
  })
  const version = JSON.stringify(
    VERSION || 'unknown version'
  )
  const gitHash = JSON.stringify(
    GIT_HASH || 'unknown hash'
  )

  const outputTxt = `
import { environment as commonEnv } from './environment.common'
export const environment = {
  ...commonEnv,
  GIT_HASH: ${gitHash},
  VERSION: ${version},
  SIIBRA_API_ENDPOINTS: ${JSON.stringify(SIIBRA_API_ENDPOINTS)},
  BACKEND_URL: ${JSON.stringify(BACKEND_URL)},
  STRICT_LOCAL: ${STRICT_LOCAL},
  MATOMO_URL: ${JSON.stringify(MATOMO_URL)},
  MATOMO_ID: ${JSON.stringify(MATOMO_ID)},
  EXPERIMENTAL_FEATURE_FLAG: ${EXPERIMENTAL_FEATURE_FLAG},
  ENABLE_LEAP_MOTION: ${ENABLE_LEAP_MOTION}
}
`
  await asyncWrite(pathToEnvFile, outputTxt, 'utf-8')
}

main()
