// jobHelpers.js
const { Queue } = require('bullmq');
const redisConnection = require('../utils/redis-configuration');

// Create a new Queue
const reRunJobQueue = new Queue('reRunJobQueue', {
  connection: redisConnection,
});

async function addReRunJob({ data, delay } = {}) {
  try {
    console.log('Adding re-run job with data:', data, 'and delay:', delay);
    await reRunJobQueue.add('processReRunJob', { data }, { delay: delay });
    console.log('Re-run job added successfully.');
  } catch (error) {
    console.error('Error adding re-run job to the queue:', error);
    throw error;
  }
}

module.exports = {
  addReRunJob,
  reRunJobQueue,
};
