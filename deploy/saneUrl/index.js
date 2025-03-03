const express = require('express')
const router = express.Router()
const { GitlabSnippetStore: Store, NotFoundError } = require('./store')
const { Store: DepcStore } = require('./depcObjStore')
const RateLimit = require('express-rate-limit')
const RedisStore = require('rate-limit-redis')
const lruStore = require('../lruStore')
const { ProxyStore, NotExactlyPromiseAny } = require('./util')

let store
try {
  store = new Store()
} catch (e) {
  console.error(`Failed to new store.`, e)
}
const depStore = new DepcStore()

const proxyStore = new ProxyStore(store)

const {
  HOSTNAME,
  HOST_PATHNAME,
  DISABLE_LIMITER,
} = process.env

function limiterMiddleware(){
  let limiter
  return async (req, res, next) => {
    if (DISABLE_LIMITER) return next()
    if (limiter) return limiter(req, res, next)
    await lruStore._initPr
    const { redisURL } = lruStore
    limiter = new RateLimit({
      windowMs: 1e3 * 5,
      max: 5,
      store: redisURL ? new RedisStore({ redisURL }) : null
    })
    return limiter(req, res, next)
  }
}


const acceptHtmlProg = /text\/html/i

const REAL_HOSTNAME = `${HOSTNAME}${HOST_PATHNAME || ''}/`

router.get('/:name', async (req, res) => {
  const { name } = req.params
  const { headers } = req
  
  const redirectFlag = acceptHtmlProg.test(headers['accept'])
    
  try {

    const json = await NotExactlyPromiseAny([
      ProxyStore.StaticGet(depStore, req, name),
      proxyStore.get(req, name)
    ])

    const { queryString, hashPath, ...rest } = json

    const xtraRoutes = []
    for (const key in rest) {
      if (/^x-/.test(key)) xtraRoutes.push(`${key}:${name}`)
    }

    if (redirectFlag) {
      if (queryString) return res.redirect(`${REAL_HOSTNAME}?${queryString}`)
      if (hashPath) {
        let redirectUrl = `${REAL_HOSTNAME}#${hashPath}`
        if (xtraRoutes.length > 0) {
          redirectUrl += `/${xtraRoutes.join('/')}`
        }
        return res.redirect(redirectUrl)
      }
    } else {
      return res.status(200).send(json)
    }
  } catch (e) {
    const notFoundFlag = e instanceof NotFoundError
    if (redirectFlag) {

      const REAL_HOSTNAME = `${HOSTNAME}${HOST_PATHNAME || ''}/`

      res.cookie(
        'iav-error', 
        notFoundFlag ? `${name} 
        
        not found` : `error while fetching ${name}.`,
        {
          httpOnly: true,
          sameSite: "strict",
          maxAge: 1e3 * 30
        }
      )
      return res.redirect(REAL_HOSTNAME)
    }
    if (notFoundFlag) return res.status(404).end()
    else return res.status(500).send(e.toString())
  }
})

router.post('/:name',
  limiterMiddleware(),
  express.json(),
  async (req, res) => {
    if (/bot/i.test(req.headers['user-agent'])) return res.status(201).end()
    if (req.headers['x-noop']) return res.status(201).end()
    const { name } = req.params
    try {
      await proxyStore.set(req, name, req.body)
      res.status(201).end()
    } catch (e) {
      console.log(e.body)
      res.status(500).send(e.toString())
    }
  }
)

router.use((_, res) => {
  res.status(405).send('Not implemneted')
})

const ready = async () => {
  return await store.healthCheck()
}

const vipRoutes = ["human", "monkey", "rat", "mouse"]

module.exports = {
  router,
  ready,
  vipRoutes,
}
