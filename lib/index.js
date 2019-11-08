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

module.exports = (_manifest) => {

    const { error, value: validatedManifest } = Schema.validate(_manifest);

    if (error) {
        throw error;
    }

    const manifest = {
        connection: {
            rabbitUrl: process.env.RABBIT_URL || 'amqp://localhost'
        },
        ...validatedManifest
    };

    const eventEmitter = new EventEmitter();
    const rabbit = manifest.connection.rabbit || Jackrabbit(manifest.connection.rabbitUrl);

    let minionsReady = manifest.workers.length;
    const checkReady = () => {
        if (--minionsReady === 0) {
            eventEmitter.emit('ready');
        }
    };

    const minions = manifest.workers.reduce((minionsByName, worker) => {

        const handlerWithValidation = validatorFactory(worker.handler, worker.validate || Joi.any());

        const minion = Minion(handlerWithValidation, {
            autoStart: false,
            rabbit,
            ...manifest.defaults || {},
            ...worker.config
        });

        minion.on('ready', checkReady);
        minion.on('message', (m, meta) => eventEmitter.emit('message', worker.config.name, m, meta));
        minion.on('error', (e) => eventEmitter.emit('error', e));

        return Object.assign(minionsByName, { [worker.config.name]: minion });
    }, {});

    const start = () => Object.values(minions).forEach((minion) => minion.start());

    return Object.assign(eventEmitter, {
        minions,
        rabbit,
        start
    });
};
