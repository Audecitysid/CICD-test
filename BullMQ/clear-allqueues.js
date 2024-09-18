const { Queue } = require('bullmq');
const redisConnection = require('../utils/redis-configuration');
const { TrendingJobWorker } = require('./processor/mainJob.processor');
const { ReRunJobWorker } = require('./processor/reRunJob.processor');
const { closeWorkersByQueueNames } = require('./services/stop-all-workers');

async function clearAllQueues(queueNames, res) {
  try {
    console.log(
      '-----------------------------------Clear all queues called-------------------------------'
    );
    // ************************ close all workers and pause all quese ************************
    await closeWorkersByQueueNames(queueNames, [
      TrendingJobWorker,
      ReRunJobWorker,
    ]);

    // *************** close all workers and pause all quese *******************
    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: redisConnection,
      });

      // Fetch and remove jobs in all states
      const jobs = await Promise.all([
        queue.getJobs([
          'waiting',
          'active',
          'delayed',
          'paused',
          'completed',
          'failed',
        ]),
      ]);

      const jobsActive = await Promise.all([queue.getJobs(['active'])]);

      if (jobsActive?.flat()?.length == 0) {
        for (const job of jobs?.flat()) {
          await job?.remove();
        }
      } else {
        const timeout =
          jobsActive?.flat()?.length && jobsActive?.flat()?.length * 3000;
        await new Promise((resolve) => setTimeout(resolve, timeout));
        for (const job of jobs?.flat()) {
          await job?.remove();
        }
      }
      console.log(`Cleared all jobs in queue: ${queueName}`);
    }
    console.log('All queues have been cleared.');
    return res.status(200).json({
      message: 'All queues have been cleared.',
    });
  } catch (error) {
    console.error('Error clearing queues:', error);
  }
}

module.exports = { clearAllQueues };
