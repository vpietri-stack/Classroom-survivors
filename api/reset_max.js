const { CosmosClient } = require('@azure/cosmos');
const config = require('./local.settings.json');

const client = new CosmosClient({ endpoint: config.Values.COSMOS_ENDPOINT, key: config.Values.COSMOS_KEY });
const container = client.database('Val-EslApp').container('Students');

async function reset() {
    const {resources} = await container.items.query("SELECT * FROM c WHERE c.id='student_max_huangruoxuan'").fetchAll();
    if(resources.length > 0) {
        let user = resources[0];
        user.password = 'max_huangruoxuan';
        user.needsPasswordChange = true;
        await container.items.upsert(user);
        console.log('Max reset successfully!');
    }
}
reset().catch(console.error);
