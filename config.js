// ============================================================
// CENTRAL API CONFIG
// Loaded before all other scripts in index.html and teacher_dashboard.html
// ============================================================

const API_BASE_URL = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
)
    ? 'http://localhost:7071/api'
    : 'https://brave-bush-0438ab000.7.azurestaticapps.net/api';

const APP_API_KEY = 'cs-app-9kXmR7pL2wQz8vNb4tYj6cEd3hFs5mKr';
