const { collectDefaultMetrics, Registry, Counter, Histogram } = require('prom-client');

// Initialisiere die Metriken
const registry = new Registry();
//collectDefaultMetrics({ register: registry });

// Zähler für die Anzahl der API-Anfragen
const apiRequestsCounter = new Counter({
    name: 'api_requests_total',
    help: 'Total number of API requests',
    labelNames: ['method', 'path'],
    registers: [registry],
});

// Histogramm für die Antwortzeiten
const responseTimeHistogram = new Histogram({
    name: 'api_response_time_seconds',
    help: 'Response time in seconds',
    labelNames: ['method', 'path'],
    registers: [registry],
});

module.exports = {
    apiRequestsCounter,
    responseTimeHistogram,
    registry
};
