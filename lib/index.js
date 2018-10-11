'use strict'

const Minion = require('@pager/minion')
const { EventEmitter } = require('events')
const Jackrabbit = require('@pager/jackrabbit')
const joi = require('joi')
const Validation = require('@pager/minion-joi')
const schema = require('./schema')

module.exports = (_manifest) => {
  const { error, value: validatedManifest } = joi.validate(_manifest, schema)

  if (error) {
    throw error
  }

  const manifest = {
    connection: {
      rabbitUrl: process.env.RABBIT_URL || 'amqp://localhost'
    },
    ...validatedManifest
  }

  const eventEmitter = new EventEmitter()
  const rabbit = manifest.connection.rabbit || Jackrabbit(manifest.connection.rabbitUrl)

  const minions = manifest.workers.reduce((minionsByName, worker) => {
    const validator = Validation(worker.validate || joi.any())
    const handlerWithValidation = validator(worker.handler)

    const minion = Minion(handlerWithValidation, {
      autoStart: false,
      rabbit,
      ...manifest.defaults || {},
      ...worker.config
    })

    minion.on('ready', (q) => eventEmitter.emit('ready', q))
    minion.on('message', (m) => eventEmitter.emit('message', worker.config.name, m))
    minion.on('error', (e) => eventEmitter.emit('error', e))

    return Object.assign(minionsByName, { [worker.config.name]: minion })
  }, {})

  const start = () => Object.values(minions).forEach((minion) => minion.start())

  return Object.assign(eventEmitter, {
    minions,
    rabbit,
    start
  })
}
