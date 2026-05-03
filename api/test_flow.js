const fetch = require('node-fetch');

async function testApi() {
    console.log("Logging in as Max...");
    const loginRes = await fetch('http://localhost:7071/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'max_huangruoxuan', password: 'max_huangruoxuan' })
    });
    
    if (!loginRes.ok) {
        console.error("Login failed!", loginRes.status, await loginRes.text());
        return;
    }
    
    const data = await loginRes.json();
    console.log("Login success! User:", data);
    
    console.log("Changing password...");
    const cpRes = await fetch('http://localhost:7071/api/changePassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, newPassword: 'newpass' })
    });
    
    if (!cpRes.ok) {
        console.error("Change password failed!", cpRes.status, await cpRes.text());
        return;
    }
    
    console.log("Change password success!", await cpRes.json());
}

testApi().catch(console.error);
