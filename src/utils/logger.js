const fs = require("fs").promises;
const path = require("path");

const logFile = path.join(__dirname, "logs", "app.log");

async function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    await fs.appendFile(logFile, logMessage);
  } catch (error) {
    console.error("Failed to write log:", error);
  }
}

const logger = {
  info(message, meta) {
    console.log(message, meta || '');
  },
  warn(message, meta) {
    console.warn(message, meta || '');
  },
  error(message, meta) {
    console.error(message, meta || '');
  },
  stream: {
    write(message) {
      console.log(message.trim());
      writeLog(message.trim());

    },
  },
};

module.exports = logger;
