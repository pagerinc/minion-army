'use strict';

const { v4: Uuid } = require('uuid');

const Lodash = require('lodash');

/**
 * This is a wrapper around the handler that creates a pino style logger and
 * adds it to a context object as a third argument of the handler
 *
 * @param {*} logger a Pino style logger
 * @param {*} minionWorkerName the name of the minion army worker
 * @param {*} handler the handler to be wrapped
 * @returns
 */
exports.createLoggerContext = (logger, minionWorkerName, handler) => {

    return (value, metadata, context = {}) => {

        let eventId;
        try {
            eventId = metadata?.properties?.headers?.eventId || Uuid();
            const routingKey = metadata?.fields?.routingKey;

            context.logger = (context.logger || logger).child({ eventId, routingKey, minionWorkerName });
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.log('There was an error while creating a child logger in %s for eventId(%s): %o', minionWorkerName, eventId, error);
        }

        return handler(value, metadata, context);
    };
};

/**
 * This utility crteates a wrapper that adds a field from the event into the logger.
 *
 * Usage:
 *
 * const Logger = require('@pager/logger');
 * const Army = require('@pager/minion-army');
 *
 * const injectEncounterIdFromEvent = injectFieldFromEventAs(Logger, 'encounterId', 'triageId');
 *
 * const handler = (message, metadata, context) {
 *     context.logger.info('handling message');
 * }
 *
 * const army = Army({
 *   workers: [
 *    {
 *      handler: injectEncounterIdFromEvent(handler),
 *      config: {
 *        name: `events.foo.encounter.state.updated`,
 *        key: '#.encounter.state.updated'
 *      },
 *      validate: Schemas.states
 *    },
 * });
 *
 * @param {*} logger a Pino style logger
 * @param {*} loggedFieldName what is the name of the field in the log line
 * @param {*} eventFieldName what is the name of the field in the event payload
 * @returns
 */
exports.injectFieldFromEventAs = (logger, loggedFieldName, eventFieldName) => (handler) => { // eslint-disable-line @hapi/hapi/scope-start, @hapi/hapi/no-arrowception

    return (value, metadata, context = {}) => {

        context.logger = (context.logger || logger).child({ [loggedFieldName]: value[eventFieldName] });

        return handler(value, metadata, context);
    };
};

/**
 * This utility function sets up default event handlers that log
 *
 * Usage:
 *
 * const Logger = require('@pager/logger');
 * const Army = require('@pager/minion-army');
 *
 * const army = Army({ ... });
 * addDefaultLoggingEventHandlers(army, 'UpdatedUserArmy', Logger);
 *
 * @param {*} army: the Army instance
 * @param {*} armyName: a unique identifier for this instance of Army
 * @param {*} parentLogger: a Pino style logger
 */
exports.addDefaultLoggingEventHandlers = (parentLogger, army, armyName) => {

    const logger = parentLogger.child({ armyName });

    army.on('error', (error) => {

        logger.error({ error }, 'Handler error in %s', armyName);
    });

    army.on('message', (queue, event, metadata) => {

        const pickedMetadata = Lodash.pick(metadata, ['properties', 'fields']);

        logger.info({ queue, event, metadata: pickedMetadata }, 'Got event in %s', armyName);
    });

    army.on('ready', (queue) => {

        logger.info({ queue }, 'Ready to consume on %s by %s', queue.name, armyName);
    });
};
