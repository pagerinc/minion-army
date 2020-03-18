'use strict';

const { EventEmitter } = require('events');
const Test = require('ava');
const Joi = require('@hapi/joi');

const Army = require('../lib/index');

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
    t.truthy(army.minions.logging);
    t.truthy(army.minions.trueing);

    t.is(await army.minions.logging.handle('hola'), 'hola');
    t.is(await army.minions.trueing.handle('hola'), true);
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

    t.notThrows(army.start);

    await t.notThrowsAsync(new Promise((resolve) => {

        army.on('ready', resolve);
    }));
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

    await t.throwsAsync(() => army.minions.logging.handle('hola'), '"value" must be of type object');
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

    await t.throws(() => Army(manifest), '"workers[0].handler" must be of type function');
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
