const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { collectDefaultMetrics, Registry, Counter, Histogram } = require('prom-client');
const logger = require('./logger'); // Winston-Logger importieren

// Initialisiere die Datenbank
const db = new sqlite3.Database(':memory:');

// Initialisiere die Metriken
const registry = new Registry();
collectDefaultMetrics({ register: registry });

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

// Erstelle die Tabelle und füge Testdaten ein
db.serialize(() => {
    logger.info('Datenbank wird initialisiert');

    const createTableQuery = `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        isComplete BOOLEAN NOT NULL
    )`;
    
    db.run(createTableQuery, (err) => {
        if (err) {
            logger.error('Fehler beim Erstellen der Tabelle todos', { error: err.message });
        } else {
            logger.info('Tabelle todos erfolgreich erstellt');
        }
    });

    const insertTestData = `INSERT INTO todos (text, isComplete) VALUES
        ('Python auffrischen', 0),
        ('JavaScript ueben', 0),
        ('React lernen', 0)`;

    db.run(insertTestData, (err) => {
        if (err) {
            logger.error('Fehler beim Einfügen von Testdaten', { error: err.message });
        } else {
            logger.info('Testdaten erfolgreich eingefügt');
        }
    });
});

// Server herunterfahren
process.on('exit', () => {
    logger.info('Server wird heruntergefahren, schließe Datenbankverbindung');
    db.close();
});

// Express-Anwendung einrichten
const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());

// Middleware zur Protokollierung und Metrik-Erfassung
app.use((req, res, next) => {
    const start = Date.now();
    
    logger.info(`Incoming request: ${req.method} ${req.url}`, { body: req.body });

    res.on('finish', () => {
        const responseTime = (Date.now() - start) / 1000; // in Sekunden
        logger.info(`Response time: ${responseTime}s`);
        
        // Metriken aktualisieren
        apiRequestsCounter.inc({ method: req.method, path: req.url });
        responseTimeHistogram.observe({ method: req.method, path: req.url }, responseTime);
    });

    next();
});

// API-Routen
app.get('/', (req, res) => {
    logger.info('Hello World Route aufgerufen');
    res.send("Hello World");
});

const selectQuery = `SELECT * FROM todos`;

app.get('/todos', (req, res) => {
    db.all(selectQuery, (err, rows) => {
        if (err) {
            logger.error('Fehler beim Abfragen der Todos', { error: err.message });
            return res.status(500).send('Internal Server Error');
        }
        logger.info('Todos erfolgreich abgerufen', { count: rows.length });
        res.json(rows);
    });
});

const insertQuery = `INSERT INTO todos (text, isComplete) VALUES (?, ?)`;

app.post('/todos', (req, res) => {
    const { text, isComplete } = req.body;

    if (!text) {
        logger.warn('Versuch, ein Todo ohne Text zu erstellen', { body: req.body });
        return res.status(400).send("Todo text cannot be empty");
    }

    db.run(insertQuery, [text, isComplete], function(err) {
        if (err) {
            logger.error('Fehler beim Erstellen eines neuen Todos', { error: err.message, body: req.body });
            return res.status(500).send('Internal Server Error');
        }
        logger.info('Neues Todo erfolgreich erstellt', { todoId: this.lastID, text });
        res.status(201).send('Todo created');
    });
});

const deleteQuery = `DELETE FROM todos WHERE id = ?`;

app.delete('/todos/:id', (req, res) => {
    const { id } = req.params;

    db.run(deleteQuery, [id], function(err) {
        if (err) {
            logger.error(`Fehler beim Löschen des Todos mit ID ${id}`, { error: err.message });
            return res.status(500).send('Internal Server Error');
        } else if (this.changes > 0) {
            logger.info(`Todo mit ID ${id} erfolgreich gelöscht`);
            res.status(200).send('Todo deleted');
        } else {
            logger.warn(`Todo mit ID ${id} nicht gefunden`);
            res.status(404).send('Todo not found');
        }
    });
});

const updateQuery = `UPDATE todos SET text = ?, isComplete = ? WHERE id = ?`;

app.put('/todos/:id', (req, res) => {
    const { id } = req.params;
    const { text, isComplete } = req.body;

    if (!text) {
        logger.warn('Versuch, ein Todo ohne Text zu aktualisieren', { body: req.body });
        return res.status(400).send("Todo text cannot be empty");
    }

    db.run(updateQuery, [text, isComplete, id], function(err) {
        if (err) {
            logger.error(`Fehler beim Aktualisieren des Todos mit ID ${id}`, { error: err.message, body: req.body });
            return res.status(500).send('Internal Server Error');
        } else if (this.changes > 0) {
            logger.info(`Todo mit ID ${id} erfolgreich aktualisiert`, { text, isComplete });
            res.status(200).send('Todo updated');
        } else {
            logger.warn(`Todo mit ID ${id} nicht gefunden`);
            res.status(404).send('Todo not found');
        }
    });
});

// Endpunkt für Prometheus-Metriken
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});

// Server starten
app.listen(port, () => {
    logger.info(`Server läuft auf http://localhost:${port}`);
});

module.exports = { app };
