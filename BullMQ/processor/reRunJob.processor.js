const { Queue, Worker } = require('bullmq');
const redisConnection = require('../../utils/redis-configuration');
const { ReCalling } = require('../services/reRunJobServices');

// Create a new Queue
const reRunJobQueue = new Queue('reRunJobQueue', {
  connection: redisConnection,
});

// Queue worker
const ReRunJobWorker = new Worker(
  'reRunJobQueue',
  async (job) => {
    console.log(
      `Processing job with ID: ${job.id} and data: ${JSON.stringify(job.data)}`
    );
    try {
      if (job?.name === 'processReRunJob') {
        await ReCalling(job.data);
      }
    } catch (error) {
      console.error(`Error processing job with ID: ${job.id}`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 166,
    limiter: {
      max: 121,
      duration: 3000,
    },
  }
);

// Job initializer
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

// Resume the queue if paused
async function resumeQueueIfPaused(queue) {
  const isPaused = await queue.isPaused();
  if (isPaused) {
    await queue.resume();
    console.log('Queue has been resumed.');
  }
}

// Cleanup function
async function ReRunJobCleanQueue() {
  try {
    await ReRunJobWorker.pause();
    console.log('Queue has been paused for cleaning.');

    const jobTypes = ['Waiting', 'Active', 'Delayed', 'Completed', 'Failed'];
    for (const type of jobTypes) {
      const jobs = await reRunJobQueue[`get${type}`]();
      for (const job of jobs) {
        try {
          await job?.remove();
          console.log(
            `Removed job with ID: ${job.id} from ${type.toLowerCase()} queue.`
          );
        } catch (err) {
          console.warn(`Could not remove job ${job?.id}: ${err.message}`);
        }
      }
    }

    await resumeQueueIfPaused(reRunJobQueue);
    console.log('Queue has been cleaned and resumed.');
    await ReRunJobWorker.resume();
  } catch (error) {
    console.error('Error during queue cleanup:', error);
  }
}

module.exports = {
  ReRunJobWorker,
  // addReRunJob,
  reRunJobQueue,
  ReRunJobCleanQueue,
};
