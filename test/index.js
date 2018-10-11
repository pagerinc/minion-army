const test = require('ava')
const Army = require('../lib/index')

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
