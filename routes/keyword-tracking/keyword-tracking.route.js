const { sortingValues } = require('../../utils/gpt/sortingValues');
const verifyToken = require('../auth/verifyToken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const router = require('express').Router();
router.post('/', verifyToken, async (req, res, next) => {
  const graphId = parseInt(req.query.graphId);
  const userId = req.user.id;
  try {
    // check graph is already liked
    const like = await prisma.like.findFirst({
      where: {
        userId,
        graphId,
      },
    });

    if (like) {
      await prisma.like.delete({
        where: {
          id: like.id,
        },
      });
    } else {
      await prisma.like.create({
        data: {
          Graph: {
            connect: {
              id: graphId,
            },
          },
          User: {
            connect: {
              id: userId,
            },
          },
        },
      });
    }

    return res
      .status(200)
      .json({ message: like ? 'unliked successfully' : 'Liked successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/all-likes', verifyToken, async (req, res, next) => {
  const userId = +req?.user?.id;
  const skip = +req?.query?.skip || 0;
  const take = +req?.query?.take || 10;
  const search = req?.query?.search || '';
  const orderBy = req?.query?.orderBy;
  const order = req?.query?.order;
  try {
    const safeSearchTerm = search && `%${search}%`;
    const count = await prisma.graph.count({
      where: {
        userId,
        AND: [
          {
            Like: {
              some: {
                userId,
              },
            },
          },
          { keyword: { contains: search, mode: 'insensitive' } },
        ],
      },
    });

    if (orderBy && !sortingValues.includes(orderBy)) {
      return res.status(400).json({ message: 'Solted value dose not exist' });
    }

    // const graphs = await prisma.graph.findMany({
    //   where: {
    //     userId,
    //     Like: {
    //       some: {
    //         userId,
    //       },
    //     },
    //   },
    //   orderBy: {
    //     id: 'desc',
    //   },
    //   include: {
    //     MonthlySearches: true,
    //     Like: true,
    //   },
    //   skip,
    //   take,
    // });

    let orderByCaluse;
    if (orderBy && order) {
      const sortedValue = ['ASC', 'DESC'];
      if (sortedValue.includes(order.toUpperCase())) {
        orderByCaluse = `  CAST("${orderBy}" AS FLOAT) ${order.toUpperCase()}`;
      }
    } else {
      orderByCaluse = `graph."id" DESC`;
    }
    let searchClause;
    if (safeSearchTerm) {
      // searchClause = `AND CAST("graph"."keyword" AS TEXT) LIKE '${safeSearchTerm}'`;
      searchClause = `AND "graph"."keyword" ILIKE '${safeSearchTerm}'`;
    } else {
      searchClause = '';
    }

    let graphsQuery = `WITH MonthlySearchAgg AS (
                SELECT
                    "MonthlySearch"."graphId",
                    json_agg("MonthlySearch".*) AS "MonthlySearches"
                FROM "MonthlySearch"
                GROUP BY "MonthlySearch"."graphId"
            ), LikeAgg AS (
                SELECT
                    "Like"."graphId",
                    json_agg("Like".*) AS "Likes"
                FROM "Like"
                WHERE "Like"."userId" = ${userId}
                GROUP BY "Like"."graphId"
            )
            SELECT
                graph.*,
                coalesce(MonthlySearchAgg."MonthlySearches", '[]') AS "MonthlySearches",
                coalesce(LikeAgg."Likes", '[]') AS "Likes"
            FROM "Graph" AS graph
            LEFT JOIN MonthlySearchAgg ON MonthlySearchAgg."graphId" = graph."id"
            LEFT JOIN LikeAgg ON LikeAgg."graphId" = graph."id"
            WHERE graph."userId" = ${userId}
            ${searchClause}
            AND EXISTS (
                SELECT 1 FROM "Like" AS l
                WHERE l."userId" = ${userId} AND l."graphId" = graph."id"
            )
            ORDER BY ${orderByCaluse}
            LIMIT ${take} OFFSET ${skip};
`;
    const graphs = await prisma.$queryRawUnsafe(graphsQuery);

    graphs.forEach((item) => {
      item.MonthlySearches.sort((a, b) => a.id - b.id);
    });
    return res.status(200).json({
      graphs,
      nextFrom: count >= take + skip ? take + skip : false,
      count: count,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
