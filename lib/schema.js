'use strict';

const Joi = require('joi');

const rabbit = Joi.object(); // TODO: validate that rabbit object complies with jackrabbit interface
const exchange = Joi.object(); // TODO: validate that exchange object complies with jackrabbit interface

const config = Joi.object({
    exchange,
    exchangeType: Joi.string().default('topic'),
    exchangeName: Joi.string(),
    name: Joi.string(),
    key: Joi.string(),
    keys: Joi.array().items(Joi.string()),
    exclusive: Joi.boolean(),
    durable: Joi.boolean(),
    autoDelete: Joi.boolean(),
    deadLetterExchange: Joi.alternatives().try(Joi.boolean().valid(false), Joi.string()),
    rabbit,
    rabbitUrl: Joi.string(),
    prefetch: Joi.number(),
    queueMode: Joi.string(),
    requeue: Joi.boolean()
});

const worker = {
    handler: Joi.func().required(),
    config,
    validate: Joi.object()
};

module.exports = Joi.object({
    connection: Joi.object({
        rabbit,
        exchange,
        rabbitUrl: Joi.string()
    }),
    defaults: config,
    workers: Joi.array().items(worker),
    logger: Joi.object({
        child: Joi.func().required()
    }).unknown(true)
});
