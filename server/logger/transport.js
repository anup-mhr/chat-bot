const { transports } = require("winston");

class Transport {
  constructor(filename, datePattern, level) {
    return new transports.DailyRotateFile({
      filename,
      datePattern,
      zippedArchive: true,
      level
    });
  }
}

module.exports = Transport;
