const test = require('ava')
const Army = require('../lib/index')
const joi = require('@hapi/joi')

test('Creates army from manifest and workers work', async t => {
  const manifest = {
    connection: {
      rabbit: {
        topic: () => ({
          publish: () => {}
        })
      }
    },
    defaults: {
      exchangeName: 'my-exchange-name'
    },
    workers: [
      {
        handler: (message) => message,
        config: {
          name: 'logging',
          key: 'events.something.happened'
        }
      },
      {
        handler: (message) => true,
        config: {
          name: 'trueing',
          key: 'events.something.happened'
        }
      }
    ]
  }

  const army = Army(manifest)

  t.truthy(army)
  t.truthy(army.minions)
  t.truthy(army.minions['logging'])
  t.truthy(army.minions['trueing'])

  t.is(await army.minions['logging'].handle('hola'), 'hola')
  t.is(await army.minions['trueing'].handle('hola'), true)
})

test('Handlers include metadata', async t => {
  const manifest = {
    connection: {
      rabbit: {
        topic: () => ({
          publish: () => {}
        })
      }
    },
    defaults: {
      exchangeName: 'my-exchange-name'
    },
    workers: [
      {
        handler: (message, metadata) => ({ message, metadata }),
        config: {
          name: 'metaworker',
          key: 'events.something.happened'
        },
        validate: joi.string()
      }
    ]
  }

  const army = Army(manifest)

  t.deepEqual(await army.minions['metaworker'].handle('hola', 'meta'), { message: 'hola', metadata: 'meta' })
})

test('Worker handler fails validation', async t => {
  const manifest = {
    connection: {
      rabbit: {
        topic: () => ({
          publish: () => {}
        })
      }
    },
    defaults: {
      exchangeName: 'my-exchange-name'
    },
    workers: [
      {
        handler: (message) => message,
        config: {
          name: 'logging',
          key: 'events.something.happened'
        },
        validate: joi.object()
      }
    ]
  }

  const army = Army(manifest)

  t.truthy(army)
  t.truthy(army.minions)
  t.truthy(army.minions['logging'])

  await t.throwsAsync(() => army.minions['logging'].handle('hola'), '"value" must be an object')
})

test('Army throws if manifest is invalid', async t => {
  const manifest = {
    defaults: {
      exchangeName: 'my-exchange-name'
    },
    workers: [
      {
        handler: 'not a func',
        config: {
          name: 'logging',
          key: 'events.something.happened'
        }
      }
    ]
  }

  await t.throws(() => Army(manifest), 'child "workers" fails because ["workers" at position 0 fails because [child "handler" fails because ["handler" must be a Function]]]')
})
