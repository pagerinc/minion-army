'use strict';

const Minion = require('@pager/minion');
const { EventEmitter } = require('events');
const Jackrabbit = require('@pager/jackrabbit');
const Joi = require('@hapi/joi');
const Schema = require('./schema');

const validatorFactory = (handler, schema) => (payload, metadata) => { // eslint-disable-line

    const { error, value } = schema.validate(payload, { stripUnknown: true });

    if (error) {
        throw error;
    }

    return handler(value, metadata);
};

const createExchange = (connection, workerConfig, exchangeMap) => {

    if (workerConfig.exchange) {
        return workerConfig.exchange;
    }

    // allow for global overriding of an exchange. this is for the expected use case that
    // any given manifest will need a single exchange
    if (connection.exchange) {
        return connection.exchange;
    }

    const exchangeName = workerConfig.exchangeName || workerConfig.name; // using the same fallbacks as minion lib
    const exchangeType = workerConfig.exchangeType;
    const exchangeMapKey = `${exchangeType}.${exchangeName}`;

    if (!exchangeMap[exchangeMapKey]) {
        exchangeMap[exchangeMapKey] = connection.rabbit[exchangeType](exchangeName);
    }

    return exchangeMap[exchangeMapKey];
};

module.exports = (_manifest) => {

    const { error, value: validatedManifest } = Schema.validate(_manifest);

    if (error) {
        throw error;
    }

    const manifest = {
        connection: {
            rabbitUrl: process.env.RABBIT_URL || 'amqp://127.0.0.1'
        },
        defaults: {},
        ...validatedManifest
    };

    manifest.connection.rabbit = manifest.connection.rabbit || Jackrabbit(manifest.connection.rabbitUrl);

    const eventEmitter = new EventEmitter();
    const exchangeMap = {};

    let minionsReady = manifest.workers.length;
    const checkReady = (queue) => {

        if (--minionsReady === 0) {
            const workerNames = manifest.workers.map((worker) => worker.config.name);
            eventEmitter.emit('ready', Object.assign({}, queue, { name: workerNames.join(', ') }));
        }
    };

    const minions = manifest.workers.reduce((minionsByName, worker) => {

        const handlerWithValidation = validatorFactory(worker.handler, worker.validate || Joi.any());
        const workerConfig = {
            autoStart: false,
            rabbit: manifest.connection.rabbit,
            ...manifest.defaults,
            ...worker.config
        };
        const exchange = createExchange(manifest.connection, workerConfig, exchangeMap);

        const minion = Minion(handlerWithValidation, { ...workerConfig, exchange });

        minion.on('ready', checkReady);
        minion.on('message', (m, meta) => eventEmitter.emit('message', worker.config.name, m, meta));
        minion.on('error', (e) => eventEmitter.emit('error', e));

        return Object.assign(minionsByName, { [worker.config.name]: minion });
    }, {});

    const start = () => Object.values(minions).forEach((minion) => minion.start());

    return Object.assign(eventEmitter, {
        exchangeMap,
        minions,
        rabbit: manifest.connection.rabbit,
        start
    });
};
