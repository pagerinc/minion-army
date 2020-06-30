'use strict';

const warnQueuingTime = (logger, metadata, maxQueuingMillis) => {

    const queue = metadata && metadata.fields && metadata.fields.routingKey;
    const timestamp_in_ms = metadata && metadata.properties && metadata.properties.headers && metadata.properties.headers.timestamp_in_ms;

    if (timestamp_in_ms) {
        const queueingTime = Date.now() - timestamp_in_ms;
        if (queueingTime > maxQueuingMillis) {
            logger.warn({ message: 'Queuing time exceeded', queue, queueingTime });
        }
    }
};

module.exports = {
    warnQueuingTime
};
