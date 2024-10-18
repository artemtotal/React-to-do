const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { apiRequestsCounter, responseTimeHistogram, registry } = require('./metrics'); 
const logger = require('./logger');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// In-Memory-Datenbank als Array
let todos = [
    { id: 1, text: 'Python auffrischen', isComplete: false },
    { id: 2, text: 'JavaScript üben', isComplete: false },
    { id: 3, text: 'React lernen', isComplete: false }
];

// Hilfsfunktion für Todo-IDs
let nextId = 4;

// Funktion zur einheitlichen Fehlerbehandlung
function handleError(res, statusCode, message) {
    logger.error(message);
    return res.status(statusCode).send({ error: message });
}

// Swagger-Dokumentation konfigurieren (bleibt unverändert)
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Todo API',
            version: '1.0.0',
            description: 'Eine API zum Verwalten von Todos',
        },
        servers: [
            {
                url: 'http://localhost:5000',
            },
        ],
        components: {
            schemas: {
                Todo: {
                    type: 'object',
                    required: ['id', 'text', 'isComplete'],
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Die ID des Todos',
                        },
                        text: {
                            type: 'string',
                            description: 'Der Text des Todos',
                        },
                        isComplete: {
                            type: 'boolean',
                            description: 'Status, ob das Todo abgeschlossen ist',
                        },
                    },
                    example: {
                        id: 1,
                        text: 'JavaScript üben',
                        isComplete: false,
                    },
                },
            },
        },
    },
    apis: ['./app.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Express-Anwendung einrichten
const app = express();
//const port = 5000;

app.use(express.json());
app.use(cors());  

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware zur Protokollierung und Metrik-Erfassung
app.use((req, res, next) => {
    const start = Date.now();
    
    logger.info(`Incoming request: ${req.method} ${req.url}`, { body: req.body });

    res.on('finish', () => {
        const responseTime = (Date.now() - start) / 1000;
        logger.info(`Response time: ${responseTime}s`);
        
        apiRequestsCounter.inc({ method: req.method, path: req.url });
        responseTimeHistogram.observe({ method: req.method, path: req.url }, responseTime);
        
        if (responseTime > 2) {
            logger.warn(`Hohe Antwortzeit: ${responseTime}s für ${req.method} ${req.url}`);
        }
    });

    next();
});

// API-Routen
app.get('/', (req, res) => {
    logger.info('Hello World Route aufgerufen');
    res.send("Hello World");
});

app.get('/todos', (req, res) => {
    logger.info('Todos erfolgreich abgerufen', { count: todos.length });
    res.json(todos);
});

app.post('/todos', (req, res) => {
    const { text, isComplete } = req.body;

    if (!text) {
        return handleError(res, 400, "Todo text cannot be empty");
    }

    const newTodo = { id: nextId++, text, isComplete: !!isComplete };
    todos.push(newTodo);

    logger.info('Neues Todo erfolgreich erstellt', { todoId: newTodo.id, text });
    res.status(201).send(newTodo);
});

app.delete('/todos/:id', (req, res) => {
    const { id } = req.params;
    const index = todos.findIndex(todo => todo.id === parseInt(id));

    if (index !== -1) {
        todos.splice(index, 1);
        logger.info(`Todo mit ID ${id} erfolgreich gelöscht`);
        res.status(200).send('Todo deleted');
    } else {
        return handleError(res, 404, `Todo mit ID ${id} nicht gefunden`);
    }
});

app.put('/todos/:id', (req, res) => {
    const { id } = req.params;
    const { text, isComplete } = req.body;

    if (!text) {
        return handleError(res, 400, "Todo text cannot be empty");
    }

    const todo = todos.find(todo => todo.id === parseInt(id));

    if (todo) {
        todo.text = text;
        todo.isComplete = !!isComplete;
        logger.info(`Todo mit ID ${id} erfolgreich aktualisiert`, { text, isComplete });
        res.status(200).send('Todo updated');
    } else {
        return handleError(res, 404, `Todo mit ID ${id} nicht gefunden`);
    }
});

// Endpunkt für Prometheus-Metriken
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});



// Server starten
// app.listen(port, () => {
//     logger.info(`Server läuft auf http://localhost:${port}`);
// });

module.exports.handler =  serverless(app) ;
