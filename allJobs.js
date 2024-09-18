const {
  TrendingJobCleanQueue,
} = require('./BullMQ/processor/mainJob.processor');
const { ReRunJobCleanQueue } = require('./BullMQ/processor/reRunJob.processor');

const allJobs = (res) => {
  try {
    TrendingJobCleanQueue();
    ReRunJobCleanQueue();
    return res.status(200).json({ message: 'Queues are being started!' });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Internal Server Error!' });
  }
};
module.exports = allJobs;
