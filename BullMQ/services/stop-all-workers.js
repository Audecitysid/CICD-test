const { Queue } = require('bullmq');
const redisConnection = require('../../utils/redis-configuration');
async function closeWorkersByQueueNames(queueNames, workersMap) {
  for (const queueName of queueNames) {
    const queue = new Queue(queueName, {
      connection: redisConnection,
    });

    await queue.pause();

    for (const worker of workersMap) {
      try {
        await worker?.close(true);
        console.log('Worker has been successfully closed');
      } catch (error) {
        console.error('Error closing worker:', error);
      }
    }
  }
}

module.exports = { closeWorkersByQueueNames };
