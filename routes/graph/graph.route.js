const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../auth/verifyToken');
const { Parser } = require('json2csv');

const prisma = new PrismaClient();

// dont remove this api
router.get(
  '/download/all-trending-graphs',
  // verifyToken,
  async (req, res, next) => {
    try {
      // const historyId = +req.params.historyId;
      // const userId = +req.user.id;

      // const historyExisted = await prisma.history.findFirst({
      //   where: { id: +historyId, userId },
      // });

      // if (!historyExisted) {
      //   return res.status(400).json({ message: 'History not found!' });
      // }

      const graphs = await prisma.graph.findMany({
        where: { trending: true },
        select: {
          keyword: true,
          competition: true,
          searchVolume: true,
          cpc: true,
          tagName: true,
          trending: true,
          volumeGrowth: true,
        },
      });

      // Convert the users data to CSV
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(graphs);

      // Set headers to inform the browser to download the file
      res.header('Content-Type', 'text/csv');
      res.attachment('graphs.csv');

      return res.status(200).send(csv);
    } catch (error) {
      console.log('error===>>>', error);
      return res.status(500).json({ message: 'Internal Server Error!', error });
    }
  }
);

router.get('/:graphId', verifyToken, async (req, res, next) => {
  const graphId = parseInt(req.params.graphId);
  try {
    const graph = await prisma.graph.findFirst({
      where: {
        id: graphId,
      },
      include: {
        MonthlySearches: true,
      },
    });
    return res.status(200).json(graph);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/download/keywords-tracking',
  verifyToken,
  async (req, res, next) => {
    try {
      const userId = +req.user.id;

      const graphs = await prisma.graph.findMany({
        where: {
          Like: {
            some: {
              userId: +userId,
            },
          },
        },
        select: {
          keyword: true,
          competition: true,
          searchVolume: true,
          cpc: true,
          tagName: true,
          trending: true,
          volumeGrowth: true,
        },
      });

      if (graphs.length !== 0) {
        // Convert the users data to CSV
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(graphs);

        // Set headers to inform the browser to download the file
        res.header('Content-Type', 'text/csv');
        res.attachment('graphs.csv');

        return res.status(200).send(csv);
      } else {
        return res
          .status(400)
          .json({ message: 'Your keyword tracking is empty!' });
      }
    } catch (error) {
      console.log('error===>>>', error);
      return res.status(500).json({ message: 'Internal Server Error!', error });
    }
  }
);

router.get('/download/single/:graphId', verifyToken, async (req, res, next) => {
  try {
    const userId = +req.user.id;
    const graphId = +req.params.graphId;

    if (!graphId) {
      return res.status(400).json({ message: 'graphId is required' });
    }

    const graph = await prisma.graph.findFirst({
      where: {
        id: +graphId,
        userId: +userId,
      },
      select: {
        keyword: true,
        competition: true,
        searchVolume: true,
        cpc: true,
        tagName: true,
        trending: true,
        volumeGrowth: true,
      },
    });

    if (graph) {
      // Convert the users data to CSV
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse([graph]);

      // Set headers to inform the browser to download the file
      res.header('Content-Type', 'text/csv');
      res.attachment('graphs.csv');

      return res.status(200).send(csv);
    } else {
      return res.status(400).json({ message: 'Graph not found!' });
    }
  } catch (error) {
    console.log('error===>>>', error);
    return res.status(500).json({ message: 'Internal Server Error!', error });
  }
});

router.get('/download/:historyId', verifyToken, async (req, res, next) => {
  try {
    const historyId = +req.params.historyId;
    const userId = +req.user.id;

    const historyExisted = await prisma.history.findFirst({
      where: { id: +historyId, userId },
    });

    if (!historyExisted) {
      return res.status(400).json({ message: 'History not found!' });
    }

    const graphs = await prisma.graph.findMany({
      where: { historyId: historyId },
      select: {
        keyword: true,
        competition: true,
        searchVolume: true,
        cpc: true,
        tagName: true,
        trending: true,
        volumeGrowth: true,
      },
    });

    // Convert the users data to CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(graphs);

    // Set headers to inform the browser to download the file
    res.header('Content-Type', 'text/csv');
    res.attachment('graphs.csv');

    return res.status(200).send(csv);
  } catch (error) {
    console.log('error===>>>', error);
    return res.status(500).json({ message: 'Internal Server Error!', error });
  }
});

module.exports = router;
