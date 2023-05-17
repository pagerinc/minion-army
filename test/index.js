'use strict';

const { EventEmitter } = require('events');
const Test = require('ava');
const Joi = require('joi');

const Sinon = require('sinon');
const { faker } = require('@faker-js/faker');

const Army = require('../lib/index');

const sandbox = Sinon.createSandbox();


Test.beforeEach((t) => {

    t.context.logger = {
        child: sandbox.stub(),
        info: sandbox.stub()
    };
    t.context.rabbit = {
        topic: () => ({
            publish: sandbox.spy()
        }),
        direct: () => ({
            publish: sandbox.spy()
        })
    };
    t.context.metadata = {
        properties: {
            headers: {
                eventId: faker.string.uuid()
            }
        },
        fields: {
            routingKey: faker.string.uuid()
        }
    };

});

Test('Creates army from manifest and workers work', async (t) => {

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
    };

    const army = Army(manifest);

    t.truthy(army);
    t.truthy(army.minions);

    t.is(Object.keys(army.minions).length, 2);
    t.truthy(army.minions.logging);
    t.truthy(army.minions.trueing);

    t.is(await army.minions.logging.handle('hola'), 'hola');
    t.is(await army.minions.trueing.handle('hola'), true);
});

Test('Fails to create army from manifest with repeated names', (t) => {

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
                handler: (message) => message,
                config: {
                    name: 'logging',
                    key: 'events.something.happened'
                }
            }
        ]
    };

    t.throws(() => Army(manifest));
});

Test('Creates army from manifest and workers start', async (t) => {

    const emitter = new EventEmitter();
    const ack = () => {};
    const nack = () => {};

    const manifest = {
        connection: {
            rabbit: {
                topic: () => ({
                    queue: ({ name }) => {

                        const queueEmitter = new EventEmitter();

                        setImmediate(() => queueEmitter.emit('connected'));
                        setImmediate(() => queueEmitter.emit('bound'));

                        return Object.assign(queueEmitter, {
                            consume: (consume) => {

                                emitter.on(`${name}:message`, consume);
                            }
                        });
                    }
                }),
                publish: (queue, msg, metadata) => {

                    const defaultMetadata = { properties: { headers: {} }, fields: {} };
                    emitter.emit(`${queue}:message`, msg, ack, nack, { ...defaultMetadata, ...metadata });
                }
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
    };

    const army = Army(manifest);

    t.truthy(army);
    t.truthy(army.minions);

    t.is(Object.keys(army.minions).length, 2);
    t.truthy(army.minions.logging);
    t.truthy(army.minions.trueing);

    t.is(await army.minions.logging.handle('hola'), 'hola');
    t.is(await army.minions.trueing.handle('hola'), true);

    const armyReady = new Promise((resolve, reject) => {

        army.on('ready', resolve);
        army.on('error', reject);
    });

    t.notThrows(army.start);

    await t.notThrowsAsync(armyReady);
});

Test('Handlers include metadata', async (t) => {

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
                validate: Joi.string()
            }
        ]
    };

    const army = Army(manifest);

    t.deepEqual(await army.minions.metaworker.handle('hola', 'meta'), { message: 'hola', metadata: 'meta' });
});

Test('Worker handler fails validation', async (t) => {

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
                validate: Joi.object()
            }
        ]
    };

    const army = Army(manifest);

    t.truthy(army);
    t.truthy(army.minions);
    t.truthy(army.minions.logging);

    await t.throwsAsync(() => army.minions.logging.handle('hola'), null, '"value" must be of type object');
});

Test('Army throws if manifest is invalid', async (t) => {

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
                handler: 'not a func',
                config: {
                    name: 'logging',
                    key: 'events.something.happened'
                }
            }
        ]
    };

    await t.throws(() => Army(manifest), null, '"workers[0].handler" must be of type function');
});

Test('Army uses same exchange for all workers unless specified', (t) => {

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
                handler: () => {},
                config: {
                    name: 'logging',
                    key: 'events.something.happened'
                }
            },
            {
                handler: () => {},
                config: {
                    name: 'logging.else',
                    key: 'events.something.else.happened'
                }
            }
        ]
    };

    const army = Army(manifest);
    t.deepEqual(Object.keys(army.exchangeMap), ['topic.my-exchange-name']);
});

Test('Army uses same legacy handler name default', (t) => {

    const manifest = {
        connection: {
            rabbit: {
                topic: () => ({
                    publish: () => {}
                })
            }
        },
        workers: [
            {
                handler: () => {},
                config: {
                    name: 'logging',
                    key: 'events.something.happened'
                }
            },
            {
                handler: () => {},
                config: {
                    name: 'logging.else',
                    key: 'events.something.else.happened'
                }
            }
        ]
    };

    const army = Army(manifest);
    t.deepEqual(Object.keys(army.exchangeMap), ['topic.logging', 'topic.logging.else']);
});

Test('Army uses connection override', (t) => {

    const manifest = {
        connection: {
            rabbit: {
                topic: () => ({
                    publish: () => {}
                })
            },
            exchange: {}
        },
        workers: [
            {
                handler: () => {},
                config: {
                    name: 'logging',
                    key: 'events.something.happened'
                }
            },
            {
                handler: () => {},
                config: {
                    name: 'logging.else',
                    key: 'events.something.else.happened'
                }
            }
        ]
    };

    const army = Army(manifest);
    t.deepEqual(Object.keys(army.exchangeMap), []);
});

Test('Army uses worker exchange overrides', (t) => {

    const manifest = {
        connection: {
            rabbit: {
                topic: () => ({
                    publish: () => {}
                }),
                direct: () => ({
                    publish: () => {}
                })
            }
        },
        defaults: {
            exchangeName: 'some-exchange-name'
        },
        workers: [
            {
                handler: () => {},
                config: {
                    name: 'type.override',
                    key: 'events.something.happened',
                    exchangeType: 'direct',
                    exchangeName: 'events.something.happened'
                }
            },
            {
                handler: () => {},
                config: {
                    name: 'name.override',
                    key: 'events.something.else.happened',
                    exchangeName: 'my-other-exchange'
                }
            },
            {
                handler: () => {},
                config: {
                    name: 'exchange.override',
                    key: 'events.something.more.happened',
                    exchange: {} // exchange objects are not validated at this moment
                }
            }
        ]
    };

    const army = Army(manifest);
    t.deepEqual(Object.keys(army.exchangeMap), ['direct.events.something.happened', 'topic.my-other-exchange']);
});


Test('Army starts with logger context', async (t) => {

    const { context: { rabbit, logger, metadata } } = t;

    const minionWorkerName = faker.word.sample();

    const handler = sandbox.spy();

    const manifest = {
        connection: {
            rabbit
        },
        defaults: {
            exchangeName: faker.word.sample()
        },
        workers: [
            {
                handler,
                config: {
                    name: minionWorkerName,
                    key: faker.word.sample()
                }
            }
        ],
        logger
    };

    const army = Army(manifest);
    t.truthy(army);

    const event = {
        data: faker.word.sample()
    };

    const childLogger = sandbox.spy();

    t.context.logger.child.returns(childLogger);

    await army.minions[minionWorkerName].handle(event, metadata);

    Sinon.assert.calledOnceWithExactly(logger.child, { eventId: metadata.properties.headers.eventId, routingKey: metadata.fields.routingKey, minionWorkerName });

    Sinon.assert.calledOnceWithExactly(handler, event, metadata, { logger: childLogger });
});
