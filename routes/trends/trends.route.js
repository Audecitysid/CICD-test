const router = require('express').Router();
const path = require('path');
const verifyToken = require('../auth/verifyToken');
const { PrismaClient } = require('@prisma/client');
const { Parser } = require('json2csv');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

router.get('/', verifyToken, async (req, res, next) => {
  const { subCategoryId, searchText } = req.query;
  const skip = parseInt(req.query.skip) || 0;
  const take = parseInt(req.query.take) || 30;
  try {
    if (subCategoryId) {
      const trends = await prisma.trend.findMany({
        where: {
          subCategoryId: +subCategoryId,
        },
        skip,
        take,
        orderBy: {
          growthInNumber: 'desc',
        },
      });
      const totalCount = await prisma.trend.count({
        where: {
          subCategoryId: +subCategoryId,
        },
      });
      return res.status(200).json({ trends, totalCount });
    } else {
      const trend = await prisma.trend.findFirst({
        where: {
          keyword: {
            contains: searchText,
          },
        },
      });
      if (trend) {
        const relativeTrends = await prisma.trend.findMany({
          where: {
            subCategoryId: +trend.subCategoryId,
          },
          skip,
          take,
          orderBy: {
            growth: 'desc',
          },
        });
        const totalCount = await prisma.trend.count({
          where: {
            subCategoryId: +trend.subCategoryId,
          },
        });
        return res.status(200).json({ trends: relativeTrends, totalCount });
      } else {
        return res.status(200).json({ message: 'No trend found' });
      }
    }
  } catch (error) {
    next(error);
  }
});

router.get('/graphs', verifyToken, async (req, res, next) => {
  try {
    const subCategoryId = parseInt(req.query.subCategoryId);
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 30;
    const orderBy = req.query.orderBy || 'createdAt';
    const order = req.query.order || 'ASC';
    if (!subCategoryId) {
      return res.status(400).json({ message: 'SubcategoryId is required' });
    }

    const isSubCatExists = await prisma.subCategory.findFirst({
      where: { id: subCategoryId },
    });

    if (!isSubCatExists) {
      return res.status(400).json({ message: 'Subcategory not found!' });
    }

    // let search = req.body.search || '';

    const count = await prisma.graph.count({
      where: { SubCategory: { some: { id: subCategoryId } }, trendDb: true },
    });

    const graphs = await prisma.graph.findMany({
      where: { SubCategory: { some: { id: subCategoryId } }, trendDb: true },
      include: { MonthlySearches: true },
      skip,
      take,
    });

    return res.status(200).json({ count, data: graphs });
  } catch (error) {
    console.log('error in gettingTrendsDBgraphs ===>>>', error);
    next();
  }
});

// dont delete this (it contains raw query for all filters "problem: database connection timeout")
// router.get('/graphs', verifyToken, async (req, res, next) => {
//   const subCategoryId = parseInt(req.query.subCategoryId);
//   const skip = parseInt(req.query.skip) || 0;
//   const take = parseInt(req.query.take) || 10;
//   const orderBy = req.query.orderBy || 'createdAt';
//   const order = req.query.order || 'ASC';
//   if (!subCategoryId) {
//     return res.status(400).json({ message: 'SubcategoryId is required' });
//   }

//   let search = req.body.search || '';

//   // Map orderBy fields that need casting for float comparisons
//   const castFields = ['cpc', 'searchVolume']; // Add any field you want to cast as a float

//   // Dynamically cast the field to float if necessary
//   let castOrderBy = castFields.includes(orderBy)
//     ? `CAST(g."${orderBy}" AS FLOAT)`
//     : `g."${orderBy}"`;

//   try {
//     const countQuery = `
//       SELECT COUNT(*)
//       FROM "Graph" g
//       LEFT JOIN "_GraphToSubCategory" gsc ON g.id = gsc."A"
//       WHERE gsc."B" = $1
//         AND g."trendDb" = true
//         AND g."keyword" ILIKE $2;
//     `;
//     // const query = `
//     //   SELECT g.*
//     //   FROM "Graph" g
//     //   LEFT JOIN "_GraphToSubCategory" gsc ON g.id = gsc."A"
//     //   WHERE gsc."B" = $1
//     //     AND g."trendDb" = true
//     //     AND g."keyword" ILIKE $2
//     //   ORDER BY ${castOrderBy} ${order}
//     //   LIMIT $3 OFFSET $4;
//     // `;
//     const query = `
//         SELECT g.*, json_agg(ms.*) AS "MonthlySearches"
//       FROM "Graph" g
//       LEFT JOIN "_GraphToSubCategory" gsc ON g.id = gsc."A"
//       LEFT JOIN "MonthlySearch" ms ON ms."graphId" = g.id
//       WHERE gsc."B" = $1
//         AND g."trendDb" = true
//         AND g."keyword" ILIKE $2
//       GROUP BY g.id
//       ORDER BY ${castOrderBy} ${order}
//       LIMIT $3 OFFSET $4;
//     `;

//     const countResult = await prisma.$queryRawUnsafe(
//       countQuery,
//       subCategoryId,
//       `%${search}%`
//     );
//     const count = parseInt(countResult[0].count, 10);
//     const data = await prisma.$queryRawUnsafe(
//       query,
//       subCategoryId,
//       `%${search}%`,
//       take,
//       skip
//     );

//     return res.status(200).json({ count, data });
//   } catch (error) {
//     console.log('error>>>>>>>>>>>>.', error);
//     next(error);
//   }
// });

router.get('/download-graphs-csv', verifyToken, async (req, res, next) => {
  const subCategoryId = parseInt(req.query.subCategoryId);
  const orderBy = req.query.orderBy || 'createdAt';
  const order = req.query.order || 'ASC';
  if (!subCategoryId) {
    return res.status(400).json({ message: 'SubcategoryId is required' });
  }

  let search = req.body.search || '';

  // Map orderBy fields that need casting for float comparisons
  const castFields = ['cpc', 'searchVolume']; // Add any field you want to cast as a float

  // Dynamically cast the field to float if necessary
  let castOrderBy = castFields.includes(orderBy)
    ? `CAST(g."${orderBy}" AS FLOAT)`
    : `g."${orderBy}"`;

  try {
    const query = `
        SELECT g.*, json_agg(ms.*) AS "MonthlySearches"
      FROM "Graph" g
      LEFT JOIN "_GraphToSubCategory" gsc ON g.id = gsc."A"
      LEFT JOIN "MonthlySearch" ms ON ms."graphId" = g.id
      WHERE gsc."B" = $1
        AND g."trendDb" = true
        AND g."keyword" ILIKE $2
      GROUP BY g.id
      ORDER BY ${castOrderBy} ${order}
    `;

    const data = await prisma.$queryRawUnsafe(
      query,
      subCategoryId,
      `%${search}%`
    );

    if (data && data?.length !== 0) {
      // Convert the users data to CSV
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(data);

      // Set headers to inform the browser to download the file
      res.header('Content-Type', 'text/csv');
      res.attachment('trend-Db-graphs.csv');

      return res.status(200).send(csv);
    } else {
      return res
        .status(400)
        .json({ message: 'Your keyword tracking is empty!' });
    }
  } catch (error) {
    console.log('error>>>>>>>>>>>>.', error);
    next(error);
  }
});

router.get('/count', verifyToken, async (req, res, next) => {
  const subCategoryId = parseInt(req.query.subCategoryId);
  const startDate = dayjs().subtract(1, 'month').toISOString(); // Subtracting 1 month from the current date
  const endDate = dayjs().toISOString(); // Current date
  console.log(startDate);
  console.log(endDate);

  if (!subCategoryId) {
    return res.status(400).json({ message: 'SubcategoryId is required' });
  }

  try {
    const trends = await prisma.graph.count({
      where: {
        SubCategory: { some: { id: +subCategoryId } },
        trendDb: true,
      },
    });

    const addedAtTd = await prisma.graph.count({
      where: {
        addedAtTd: {
          gte: startDate, // Start date
          lte: endDate, // End date
        },
        SubCategory: { some: { id: +subCategoryId } },
        trendDb: true,
      },
    });

    return res.status(200).json({ addedAtTd, trends });
  } catch (error) {
    console.log('error>>>>>>>>>>>>.', error);
    next(error);
  }
});

module.exports = router;
