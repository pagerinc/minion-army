'use strict';

const Test = require('ava');

const Sinon = require('sinon');
const { faker } = require('@faker-js/faker');

const Army = require('../lib/index');
const { createLoggerContext, injectFieldFromEventAs, addDefaultLoggingEventHandlers } = require('../lib/loggingUtils');

const sandbox = Sinon.createSandbox();


Test.beforeEach((t) => {

    t.context.logger = {
        child: sandbox.stub()
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
    t.context.event = sandbox.spy();
    t.context.minionWorkerName = faker.word.sample();
    t.context.handler = sandbox.spy();
    t.context.rabbit = {
        topic: () => ({
            publish: sandbox.spy()
        })
    };
});

Test.afterEach((t) => {

    sandbox.restore();
});

Test('createLoggerContext wraps a handler', (t) => {

    const { context: { logger, event, metadata, minionWorkerName, handler } } = t;

    const wrappedHandler = createLoggerContext(logger, minionWorkerName, handler);

    const childLogger = sandbox.spy();

    t.context.logger.child.returns(childLogger);

    wrappedHandler(event, metadata);

    Sinon.assert.calledOnceWithExactly(logger.child, { eventId: metadata.properties.headers.eventId, routingKey: metadata.fields.routingKey, minionWorkerName });

    Sinon.assert.calledOnceWithExactly(handler, event, metadata, { logger: childLogger });

    t.pass();
});

Test('createLoggerContext does not fail if the logger fails', (t) => {

    const { context: { logger, event, metadata, minionWorkerName, handler } } = t;

    const wrappedHandler = createLoggerContext(logger, minionWorkerName, handler);

    t.context.logger.child.throws(new Error('failed to create logger'));

    wrappedHandler(event, metadata);

    Sinon.assert.calledOnceWithExactly(logger.child, { eventId: metadata.properties.headers.eventId, routingKey: metadata.fields.routingKey, minionWorkerName });

    Sinon.assert.calledOnceWithExactly(handler, event, metadata, {});

    t.pass();
});

Test('injectFieldFromEventAs adds field to the logger', (t) => {

    const { context: { logger, metadata, handler } } = t;

    const wrappedHandler = injectFieldFromEventAs(logger, 'encounterId', 'triageId')(handler);

    const childLogger = sandbox.spy();

    t.context.logger.child.returns(childLogger);

    const event = {
        triageId: faker.database.mongodbObjectId()
    };

    wrappedHandler(event, metadata);

    Sinon.assert.calledOnceWithExactly(logger.child, { encounterId: event.triageId });

    Sinon.assert.calledOnceWithExactly(handler, event, metadata, { logger: childLogger });

    t.pass();
});

Test('injectFieldFromEventAs does not add the field to the logger if it is missing', (t) => {

    const { context: { logger, metadata, handler } } = t;

    const wrappedHandler = injectFieldFromEventAs(logger, 'encounterId', 'triageId')(handler);

    const childLogger = sandbox.spy();

    t.context.logger.child.returns(childLogger);

    const event = {};

    wrappedHandler(event, metadata);

    Sinon.assert.calledOnceWithExactly(logger.child, { encounterId: undefined });

    Sinon.assert.calledOnceWithExactly(handler, event, metadata, { logger: childLogger });

    t.pass();
});


Test('addDefaultLoggingEventHandlers adds the handlers', (t) => {

    const { context: { logger, rabbit, metadata } } = t;

    const workerName = faker.word.sample();
    const queueName = faker.word.sample();

    const manifest = {
        connection: {
            rabbit
        },
        defaults: {
            exchangeName: faker.word.sample()
        },
        workers: [
            {
                handler: sandbox.spy(),
                config: {
                    name: workerName,
                    key: queueName
                }
            }
        ]
    };

    const army = Army(manifest);

    t.truthy(army);

    const childLogger = {
        info: sandbox.spy()
    };

    t.context.logger.child.returns(childLogger);

    const armyName = faker.word.sample();

    addDefaultLoggingEventHandlers(logger, army, armyName);

    Sinon.assert.calledOnceWithExactly(logger.child, { armyName });

    const event = {
        data: faker.word.sample()
    };

    army.minions[workerName].handle(event, metadata);

    const expectedMetadata = {
        properties: metadata.properties,
        fields: metadata.fields
    };

    Sinon.assert.calledOnceWithExactly(childLogger.info, { queue: workerName, event, metadata: expectedMetadata }, 'Got event in %s', armyName);
});
