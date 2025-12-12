const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const redis = require("redis");

class RedisWithJson {
  constructor(options) {
    // Redis v4+ configuration format
    const redisConfig = {
      socket: {
        host: options.host,
        port: options.port,
        reconnectStrategy:
          options.retry_strategy ||
          ((retries) => Math.min(retries * 100, 3000)),
      },
    };

    if (options.password) {
      redisConfig.password = options.password;
    }

    this._client = redis.createClient(redisConfig);
    this._ready = false;

    this._client.on("connect", () => {
      console.log("Redis: connected");
    });

    this._client.on("ready", () => {
      console.log("Redis: ready");
      this._ready = true;
    });

    this._client.on("end", () => {
      console.log("Redis: end");
      this._ready = false;
    });

    this._client.on("reconnecting", () => {
      console.log("Redis: reconnecting");
      this._ready = false;
    });

    this._client.on("error", function (error) {
      console.error("Redis: error", error);
    });

    // Auto-connect (you can also call this manually in your server.js)
    this._client.connect().catch(console.error);
  }

  async hget(key, field) {
    try {
      const result = await this._client.hGet(key || "", field || "");
      return result ? JSON.parse(result) : {};
    } catch (error) {
      console.log(`Redis hget error [${key}.${field}]:`, error);
      return {};
    }
  }

  async hgetall(key) {
    try {
      const result = await this._client.hGetAll(key || "");
      if (!result || Object.keys(result).length === 0) return {};

      return Object.keys(result).reduce((accumulator, current) => {
        try {
          accumulator[current] = JSON.parse(result[current]);
        } catch {
          accumulator[current] = result[current];
        }
        return accumulator;
      }, {});
    } catch (error) {
      console.log(`Redis hgetall error [${key}]:`, error);
      return {};
    }
  }

  async hset(key, field, data, recurse = []) {
    try {
      if (!key || !field) {
        return null;
      }
      const existing = await this.hget(key, field);
      if (recurse.length) {
        recurse.forEach((key) => {
          data[key] = { ...existing[key], ...data[key] };
        });
      }
      await this._client.hSet(
        key || "",
        field || "",
        JSON.stringify({ ...existing, ...data } || {})
      );
    } catch (error) {
      console.log(`Redis hset error [${key}.${field}]:`, error);
    }
  }

  async hdel(key, ...fields) {
    try {
      if (fields.length > 0) {
        await this._client.hDel(key || "", fields);
      }
    } catch (error) {
      console.log(`Redis hdel error [${key}]:`, error);
    }
  }

  async del(key) {
    try {
      return await this._client.del(key);
    } catch (error) {
      console.log(`Redis del error [${key}]:`, error);
      return 0;
    }
  }

  async acquireLock(key, ttl = 5) {
    try {
      const result = await this._client.set(key, "1", {
        NX: true,
        EX: ttl,
      });
      return result === "OK";
    } catch (error) {
      console.log(`Redis acquireLock error [${key}]:`, error);
      return false;
    }
  }

  async ttl(key) {
    try {
      return await this._client.ttl(key);
    } catch (error) {
      console.log(`Redis TTL error for key ${key}`, error);
      return null;
    }
  }

  async releaseLock(key) {
    return await this.del(key);
  }

  async disconnect() {
    try {
      await this._client.quit();
      this._ready = false;
    } catch (error) {
      console.log("Redis disconnect error:", error);
    }
  }
}

const client = new RedisWithJson({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retry_strategy: (retry) => retry * 100 || 3000,
});

module.exports = { client };
