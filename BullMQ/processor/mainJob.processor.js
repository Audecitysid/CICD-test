const { Queue, Worker } = require('bullmq');
const redisConnection = require('../../utils/redis-configuration');
const MainJobService = require('../services/mainJobService');

// creating main job queue
const TrendingJobQueue = new Queue('TrendingJobQueue', {
  connection: redisConnection,
});

// main job Queue worker
const TrendingJobWorker = new Worker(
  'TrendingJobQueue',
  async (job) => {
    if (job?.name === 'repopulateMainJobQueue') {
      await Promise.all([
        TrendingJobQueue.getCompleted(),
        TrendingJobQueue.getFailed(),
      ]).then(async (results) => {
        for (const jobs of results) {
          for (const job of jobs) {
            try {
              await job?.remove();
            } catch (err) {
              console.warn(`Could not remove job ${job?.id}: ${err.message}`);
            }
          }
        }
      });

      await initializeJobs();
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 3000,
    },
  }
);

// job initializer
async function initializeJobs() {
  try {
    const count = 0;
    await MainJobService(count);
  } catch (err) {
    throw err.data;
  }
}

function addMainJob({ slot }) {
  TrendingJobQueue.add('processMainJobQueue', { slot });
}

async function resumeQueueIfPaused(queue) {
  const isPaused = await queue.isPaused();
  if (isPaused) {
    await queue.resume();
    console.log('Queue has been resumed.');
  }
}

// cleanup function
async function TrendingJobCleanQueue() {
  try {
    await TrendingJobWorker.pause();

    await Promise.all([
      TrendingJobQueue.getWaiting(),
      TrendingJobQueue.getActive(),
      TrendingJobQueue.getDelayed(),
      TrendingJobQueue.getCompleted(),
      TrendingJobQueue.getFailed(),
    ])
      .then(async (results) => {
        for (const jobs of results) {
          for (const job of jobs) {
            try {
              await job?.remove();
            } catch (err) {
              console.warn(`Could not remove job ${job?.id}: ${err.message}`);
            }
          }
        }
      })
      .then(async () => {
        await initializeJobs();
        await resumeQueueIfPaused(TrendingJobQueue);
        // Setting up the recurring job
        TrendingJobQueue.add(
          'repopulateMainJobQueue',
          {},
          {
            repeat: {
              pattern: '0 0 * * 6',
            },
          }
        );
      });
    await TrendingJobWorker.resume();
    console.log('Queue has been cleaned.');
  } catch (error) {
    console.log('main job error ==========>>>>>>>>>', error);
  }
}

module.exports = {
  TrendingJobWorker,
  addMainJob,
  TrendingJobQueue,
  TrendingJobCleanQueue,
};
