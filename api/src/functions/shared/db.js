const { CosmosClient } = require('@azure/cosmos');

// Centralized Cosmos client + container.
// DB/container names are env-overridable so a test/staging deployment can point
// at an isolated database WITHOUT editing function code. Live settings do not
// set COSMOS_DB_NAME / COSMOS_CONTAINER_NAME, so they fall back to the
// production values (Val-EslApp / Students) — behaviour unchanged for live.
let _client = null;
let _container = null;
let _samplesContainer = null;
let _samplesClient = null;
let _handwritingContainer = null;

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

// Consented-student speech recordings kept for offline ASR research. Deliberately
// a SEPARATE container from Students: it holds base64 audio blobs ~200 KB each,
// and a stray large write here must never be able to touch student progress.
// Must live in the same database so it shares that database's existing autoscale
// pool — a second database would need its own 1000 RU/s minimum and would push
// the account past the Cosmos free-tier ceiling.
function getSamplesContainer() {
    if (!_samplesContainer) {
        const dbName = process.env.COSMOS_DB_NAME || 'Val-EslApp';
        const containerName = process.env.COSMOS_SPEECH_SAMPLES_CONTAINER || 'speech_samples';
        // Research is disposable. Do not hold workers in long SDK retry loops
        // while the normal progress client is trying to save a child's work.
        if (!_samplesClient) _samplesClient = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY,
            connectionPolicy: {
                requestTimeout: 4000,
                retryOptions: { maxRetryAttemptCount: 0, maxWaitTimeInSeconds: 0 },
            },
        });
        _samplesContainer = _samplesClient.database(dbName).container(containerName);
    }
    return _samplesContainer;
}

// Handwriting traces from study mode's writing round, kept so the letter
// geometry can be tuned against real children's ink instead of synthetic pen
// paths. Same reasoning as the speech container above: separate from Students so
// a research write can never touch student progress, same database so it shares
// the existing autoscale pool instead of needing a second 1000 RU/s minimum.
function getHandwritingContainer() {
    if (!_handwritingContainer) {
        const dbName = process.env.COSMOS_DB_NAME || 'Val-EslApp';
        const containerName = process.env.COSMOS_HANDWRITING_SAMPLES_CONTAINER || 'handwriting_samples';
        _handwritingContainer = getClient().database(dbName).container(containerName);
    }
    return _handwritingContainer;
}

module.exports = { getContainer, getSamplesContainer, getHandwritingContainer, getClient };
