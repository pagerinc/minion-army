const Joi = require('joi')

const rabbit = Joi.object() // TODO: validate that rabbit object complies with jackrabbit interface

const config = {
  exchangeType: Joi.string(),
  exchangeName: Joi.string(),
  name: Joi.string(),
  key: Joi.string(),
  keys: Joi.array().items(Joi.string()),
  exclusive: Joi.boolean(),
  durable: Joi.boolean(),
  autoDelete: Joi.boolean(),
  deadLetterExchange: Joi.alternatives().try([Joi.boolean().valid(false), Joi.string()]),
  rabbit,
  rabbitUrl: Joi.string()
}

const worker = {
  handler: Joi.func().required(),
  config,
  validate: Joi.object()
}

module.exports = {
  connection: Joi.object({
    rabbit,
    rabbitUrl: Joi.string()
  }),
  defaults: config,
  workers: Joi.array().items(worker)
}
