const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
const fs = require('fs');
const path = require('path');

// Erstelle das logs-Verzeichnis, wenn es nicht existiert
const logDirectory = path.join(__dirname, 'logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

const logger = createLogger({
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new transports.Console(), // Logs in die Konsole
        new transports.File({ filename: path.join(__dirname,'logs/error.log'), level: 'error' }), // Nur Fehler in error.log
        new transports.File({ filename: path.join(__dirname,'logs/app.log')})
    ]
});

// Beispiel-Logs
logger.info('This is an info message');
logger.warn('This is a warning message');
logger.error('This is an error message');

module.exports = logger;
