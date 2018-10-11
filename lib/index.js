'use strict'

const Minion = require('@pager/minion')
const { EventEmitter } = require('events')
const Jackrabbit = require('@pager/jackrabbit')

module.exports = (_manifest) => {
  // TODO: validate manifest against schema
  const manifest = {
    connection: {
      rabbitUrl: process.env.RABBIT_URL || 'amqp://localhost'
    },
    ..._manifest
  }

  const eventEmitter = new EventEmitter()
  const rabbit = manifest.connection.rabbit || Jackrabbit(manifest.connection.rabbitUrl)

  const minions = manifest.workers.reduce((minionsByName, worker) => {
    const minion = Minion(worker.handler, {
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
