const express = require('express')
const datasetsRouter = express.Router()
const { init, getDatasets } = require('./query')

init().catch(e => {
  console.warn(`dataset init failed`, e)
})

datasetsRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache')
  next()
})

datasetsRouter.get('/templateName/:templateName', (req, res, next) => {
  const { templateName } = req.params
  const { user } = req
  getDatasets({ templateName, user })
    .then(ds => {
      const data = JSON.stringify(ds)
      res.status(200).send(data)
    })
    .catch(error => {
      next({
        code: 500,
        error
      })
    })
})



datasetsRouter.get('/parcellationName/:parcellationName', (req, res, next) => {
  const { parcellationName } = req.params
  const { user } = req
  getDatasets({ parcellationName, user })
    .then(ds => {
      res.status(200).send(JSON.stringify(ds))
    })
    .catch(error => {
      next({
        code: 500,
        error
      })
    })
})

module.exports = datasetsRouter