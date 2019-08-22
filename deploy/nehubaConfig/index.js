const express = require('express')
const { getTemplateNehubaConfig } = require('./query')
const { detEncoding } = require('../compression')

const nehubaConfigRouter = express.Router()

nehubaConfigRouter.get('/:configId', (req, res, next) => {

  const header = req.get('Accept-Encoding')
  const acceptedEncoding = detEncoding(header)

  const { configId } = req.params
  res.set('Content-Encoding', acceptedEncoding)

  getTemplateNehubaConfig({ configId, acceptedEncoding, returnAsStream:true}).pipe(res)
})

module.exports = nehubaConfigRouter