const redis = require("redis");

class RedisWithJson {
  constructor(options) {
    this._client = redis.createClient(options);

    this._client.on("connect", () => {
      console.log("Redis: connected");
    });

    this._client.on("end", () => {
      console.log("Redis: end");
    });

    this._client.on("error", function (error) {
      console.error("Redis: error", error);
    });

    this._client.connect(); // v4 requires explicit connect()
  }

  async hget(key, field) {
    const reply = await this._client.hGet(key, field);
    return reply ? JSON.parse(reply) : {};
  }

  async hgetall(key) {
    const reply = await this._client.hGetAll(key);
    Object.keys(reply).forEach((k) => {
      try {
        reply[k] = JSON.parse(reply[k]);
      } catch {}
    });
    return reply;
  }

  async hset(key, field, data, recurse = []) {
    if (!key || !field) return null;

    const existing = await this.hget(key, field);

    if (recurse.length) {
      recurse.forEach((rKey) => {
        data[rKey] = { ...existing[rKey], ...data[rKey] };
      });
    }

    await this._client.hSet(
      key,
      field,
      JSON.stringify({ ...existing, ...data })
    );
  }

  async hdel(key, ...fields) {
    await this._client.hDel(key, fields);
  }

  async del(key) {
    await this._client.del(key);
  }
}

const client = new RedisWithJson({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD,
});

module.exports = { client };
