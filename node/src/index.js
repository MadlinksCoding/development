"use strict";

const EnvLoader = require("./utils/EnvLoader");

if (!global.ENV) {
  global.ENV = EnvLoader.loadEnv();
}

if (!global.ENV) {
  throw new Error("ENV");
}

module.exports = process.env;
