const bullMaster = require('bull-master');
const { TrendingJobQueue } = require('./processor/mainJob.processor');
const { reRunJobQueue } = require('./processor/reRunJob.processor');

const bullMasterApp = bullMaster({
  queues: [TrendingJobQueue, reRunJobQueue],
});

module.exports = bullMasterApp;
