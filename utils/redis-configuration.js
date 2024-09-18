const Redis = require('ioredis');

const redisConnection = new Redis({
  // host: 'localhost',
  host: process.env.NEW_REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: null,
  password: process.env.REDIS_PASSWORD,
  // any other configurations
});

// Listen for the 'connect' event to log when the connection is successfully established
redisConnection.on('connect', () => {
  console.log('Redis connected successfully');
});
// Handle connection errors
redisConnection.on('error', (err) => {
  console.error('Error connecting to Redis', err);
});

redisConnection.setMaxListeners(0);
module.exports = redisConnection;
