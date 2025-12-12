const { createLogger, format } = require("winston");
const { combine, timestamp, label } = format;

class Logger {
  constructor(format, transports) {
    return createLogger({
      format: combine(label({ label: "log" }), timestamp(), format),
      transports
    });
  }
}

module.exports = Logger;