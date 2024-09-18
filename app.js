const express = require('express');
const createError = require('http-errors');
const morgan = require('morgan');
require('dotenv').config();
const cors = require('cors');
const authRoutes = require('./routes/auth/auth');
const userSearchRoutes = require('./routes/search/search.route');
const historyRoutes = require('./routes/history/history.routes');
const graphRoutes = require('./routes/graph/graph.route');
const keywordTracking = require('./routes/keyword-tracking/keyword-tracking.route');
const trendsRoutes = require('./routes/trends/trends.route');
const categoryRoutes = require('./routes/trends/categories/categories.route');
const stripeRoutes = require('./routes/stripe/stripe.route');
const stripeWebhookRoute = require('./routes/stripe/stripe-webhook.route');
const gptRoutes = require('./routes/gpt/gpt.route');
const userRoutes = require('./routes/user/user');
const subCategoryRoutes = require('./routes/trends//sub-categories/sub-categories.route');
const dashboardRoutes = require('./routes/dasboard/user');
const allJobs = require('./allJobs');
const bullMasterApp = require('./BullMQ/bullMq-declaration');
const { clearAllQueues } = require('./BullMQ/clear-allqueues');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { Parser } = require('json2csv');
const path = require('path');

const prisma = new PrismaClient();

const app = express();
app.use(cors());

// this route should be here because in this we need express.raw not express.json
app.use('/stripe-webhook', stripeWebhookRoute);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// Enable all CORS requests

// import routes
app.use('/auth', authRoutes);
app.use('/search', userSearchRoutes);
app.use('/history', historyRoutes);
app.use('/graph', graphRoutes);
app.use('/like-unlike', keywordTracking);
app.use('/trends', trendsRoutes);
app.use('/category', categoryRoutes);
app.use('/sub-category', subCategoryRoutes);
app.use('/current-ai', gptRoutes);
app.use('/stripe', stripeRoutes);
app.use('/user', userRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin/queues', bullMasterApp);

app.get('/', async (req, res, next) => {
  res.send({ message: 'Awesome it works fine 🐻' });
});

// GET endpoint to fetch all migrations
app.get('/migrations', async (req, res) => {
  try {
    const query = `SELECT * FROM "_prisma_migrations";`;
    const migrations = await prisma.$queryRawUnsafe(query);
    return res.json(migrations);
  } catch (error) {
    console.log('error while getting migrations ===>>', error);
    return res
      .status(500)
      .json({ message: 'Error fetching migrations', error: error.message });
  }
});

app.get('/download-migrations', async (req, res) => {
  try {
    // Step 1: Query the database for migration details
    const migrations =
      await prisma.$queryRaw`SELECT * FROM "_prisma_migrations";`;

    // Step 2: Prepare a directory for the migration files
    const tempDir = path.join(__dirname, 'temp_migrations');
    await fse.ensureDir(tempDir);

    // Step 3: Copy each relevant migration file into the temp directory
    for (const migration of migrations) {
      const sourceFilePath = path.join(
        __dirname,
        'prisma/migrations',
        migration.folder_name,
        'migration.sql'
      );
      if (await fse.pathExists(sourceFilePath)) {
        await fse.copy(
          sourceFilePath,
          path.join(tempDir, migration.name + '.sql')
        );
      }
    }

    // Step 4: Zip the directory
    res.attachment('migrations.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.directory(tempDir, false);
    archive.pipe(res);
    archive.finalize();

    // Clean up after sending the file
    archive.on('end', () => {
      fse.remove(tempDir);
    });
  } catch (error) {
    console.error('Failed to download migrations:', error);
    res.status(500).send({ error: error.message });
  }
});

// to start the job
app.post('/start-queues', (req, res) => {
  allJobs(res);
});
// to clear the jobs
app.post('/clear-queues', (req, res) =>
  clearAllQueues(['TrendingJobQueue', 'reRunJobQueue'], res)
);

app.use((req, res, next) => {
  next(createError.NotFound());
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send({
    status: err.status || 500,
    message: err.message,
  });
});

const downloadActiveUsersEmail = async () => {
  try {
    const users = await prisma.user.findMany({
      where: {
        deleted: false,
        Plan: {
          some: {
            status: true,
            subscribed: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    // Convert the users data to CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(users);

    // Define the file path in the root directory
    const filePath = path.join(__dirname, `active_users_${Date.now()}.csv`);

    // Save the CSV to the file system in the root directory
    fs.writeFileSync(filePath, csv);
  } catch (error) {
    console.log('error===>>>', error);
  }
};

// downloadActiveUsersEmail();

const PORT = process.env.PORT || 3050;
app.listen(PORT, () => console.log(`🚀 @ http://localhost:${PORT}`));
