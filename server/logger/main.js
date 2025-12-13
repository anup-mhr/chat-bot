require("winston-daily-rotate-file");
const { transports } = require("winston");
const messageFormat = require("./format");
const Transport = require("./transport");
const Logger = require("./logger");

// this log or its higher levels are considered.
const baseLog = "info";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  silly: 5,
};

module.exports = {};
