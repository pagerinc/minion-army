# minion-army
Microservice Framework for RabbitMQ Workers

## usage

```javascript
const Army = require('@pager/minion-army');

const manifest = {
    connection: { // optional, if not provided will default to a rabbit connection to local host
        rabbitUrl: 'amqp://localhost'
    },
    defaults: { // default values that apply for all workers
        exchangeName: 'my-exchange-name'
    },
    workers: [
        {
            handler: (message) => console.log('my job is to log this', message),
            config: { // same config as expected by minions
                name: 'jobs.logging',
                key: 'events.something.happened'
            }
        },
        {
            handler: (message) => true,
            config: {
                name: `jobs.trueing`,
                key:  `events.something.happened`
            }
        }
    ]
};

const army = Army(manifest);

army.start(); // if you provide defaults.autoStart = true this is not needed
```