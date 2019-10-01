const express = require('express')
const { getTemplateNehubaConfig } = require('./query')
const { detEncoding } = require('nomiseco')

const nehubaConfigRouter = express.Router()

nehubaConfigRouter.get('/:configId', (req, res, next) => {

  const header = req.get('Accept-Encoding')
  const acceptedEncoding = detEncoding(header)

  const { configId } = req.params
  if (acceptedEncoding) res.set('Content-Encoding', acceptedEncoding)

  getTemplateNehubaConfig({ configId, acceptedEncoding, returnAsStream:true}).pipe(res)
})

module.exports = nehubaConfigRouter