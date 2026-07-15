const { CosmosClient } = require('@azure/cosmos');

// Centralized Cosmos client + container.
// DB/container names are env-overridable so a test/staging deployment can point
// at an isolated database WITHOUT editing function code. Live settings do not
// set COSMOS_DB_NAME / COSMOS_CONTAINER_NAME, so they fall back to the
// production values (Val-EslApp / Students) — behaviour unchanged for live.
let _client = null;
let _container = null;

function getClient() {
    if (!_client) {
        _client = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY,
        });
    }
    return _client;
}

function getContainer() {
    if (!_container) {
        const dbName = process.env.COSMOS_DB_NAME || 'Val-EslApp';
        const containerName = process.env.COSMOS_CONTAINER_NAME || 'Students';
        _container = getClient().database(dbName).container(containerName);
    }
    return _container;
}

module.exports = { getContainer, getClient };
