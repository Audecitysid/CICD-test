const { sortingValues } = require('../../utils/gpt/sortingValues');
const verifyToken = require('../auth/verifyToken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const router = require('express').Router();

// router.get('/', verifyToken, async (req, res, next) => {
//   const userId = req.user.id;
//   const { searchText } = req.query;
//   try {
//     // checking whether aws rds is accessible or not
//     // const temp = await prisma.history.findMany({});

//     const history = await prisma.history.findMany({
//       where: {
//         userId,
//         searchKeyword: {
//           contains: searchText,
//         },
//       },
//       select: {
//         id: true,
//         searchKeyword: true,
//       },
//     });
//     return res.status(200).json({ history: history.reverse() });
//   } catch (error) {
//     next(error);
//   }
// });

// ********************* New History API *********************

router.get('/', verifyToken, async (req, res, next) => {
  const userId = req.user.id;
  const { skip = 0, take = 10, orderBy, order } = req.query;

  try {
    // checking whether aws rds is accessible or not
    const count = await prisma.history.count({
      where: {
        userId,
      },
      ...(orderBy
        ? {
            orderBy: {
              [orderBy]: order,
            },
          }
        : {}),
    });

    const histories = await prisma.history.findMany({
      where: {
        userId,
      },
      ...(orderBy
        ? {
            orderBy: {
              [orderBy]: order,
            },
          }
        : {
            orderBy: {
              createdAt: 'desc',
            },
          }),
      skip: +skip,
      take: +take,
      select: {
        id: true,
        aiStrength: true,
        description: true,
        goal: true,
        region: true,
        searchKeyword: true,
        createdAt: true,
      },
    });

    const historiesWithCounts = await Promise.all(
      histories.map(async (history) => {
        const totalGraphsCount = await prisma.graph.count({
          where: {
            historyId: history?.id,
          },
        });
        const graph = await prisma.graph.findFirst({
          where: {
            historyId: history?.id,
            keyword: history?.searchKeyword,
          },
          // include: { MonthlySearches: true },
          include: { MonthlySearches: true },
        });

        const trendingGraphsCount = await prisma.graph.count({
          where: {
            historyId: history?.id,
            trending: true,
          },
        });

        return {
          ...history,
          graph: graph,
          totalGraphs: totalGraphsCount,
          trendingGraphs: trendingGraphsCount,
        };
      })
    );
    return res.status(200).json({
      history: historiesWithCounts,
      nextFrom: count >= take + skip ? take + skip : false,
      count,
    });
  } catch (error) {
    next(error);
  }
});

// router.get("/graph", verifyToken, async (req, res, next) => {
//   const historyId = parseInt(req.query.historyId);
//   const skip = parseInt(req.query.skip) || 0;
//   const take = parseInt(req.query.take) || 30;
//   const { isTrending } = req.query;
//   let tagName = req.query.tagName;
//   // for showing all graphs with all tags
//   // if (tagName === "all") {
//   //   tagName = null;
//   // }

//   try {
//     let graphInclude = {
//       skip,
//       take,
//       orderBy: {
//         searchVolume: "desc",
//       },
//       include: {
//         MonthlySearches: {
//           orderBy: {
//             id: "asc",
//           },
//           select: {
//             id: true,
//             month: true,
//             searchVolume: true,
//             year: true,
//           },
//         },
//         Like: true,
//       },
//     };

//     let totalGraphs;

//     if (isTrending === "true" && !tagName) {
//       graphInclude = {
//         ...graphInclude,
//         where: {
//           trending: true,
//         },
//       };
//       // Query the total number of Graph objects for the specified historyId
//       totalGraphs = await prisma.graph.count({
//         where: {
//           historyId,
//           trending: true,
//         },
//       });
//     } else if (tagName && isTrending !== "true") {
//       graphInclude = {
//         ...graphInclude,
//         where: {
//           tagName,
//         },
//       };

//       totalGraphs = await prisma.graph.count({
//         where: {
//           historyId,
//           tagName,
//         },
//       });
//     } else if (isTrending === "true" && tagName) {
//       graphInclude = {
//         ...graphInclude,
//         where: {
//           tagName: tagName,
//           trending: true,
//         },
//       };

//       totalGraphs = await prisma.graph.count({
//         where: {
//           historyId,
//           tagName,
//           trending: true,
//         },
//       });
//     } else {
//       totalGraphs = await prisma.graph.count({
//         where: {
//           historyId,
//         },
//       });
//     }

//     const tempHistory = await prisma.history.findFirst({
//       where: {
//         id: historyId,
//       },
//       include: {
//         Graph: graphInclude,
//       },
//     });

//     const history = {
//       ...tempHistory,
//       totalGraphs,
//     };
//     return res.status(200).json(history);
//   } catch (error) {
//     next(error);
//   }
// });

router.post('/graph', verifyToken, async (req, res, next) => {
  const historyId = parseInt(req.body.historyId);
  const skip = parseInt(req.body.skip) || 0;
  const take = parseInt(req.body.take) || 30;
  const orderBy = req.body.orderBy || 'createdAt';
  const order = req.body.order || 'ASC';

  const { isTrending } = req.body;

  let search = req.body.search || '';

  try {
    const safeSearchTerm = search && `%${search}%`;
    let graphsQuery;
    let trendingGraphs;
    let totalGraphs;

    if (orderBy && !sortingValues.includes(orderBy)) {
      return res.status(400).json({ message: 'Solted value dose not exist' });
    }

    let orderByCaluse;
    if (orderBy && order) {
      const sortedValue = ['ASC', 'DESC'];
      if (sortedValue.includes(order.toUpperCase())) {
        orderByCaluse = `ROW_NUMBER() OVER (ORDER BY g."${orderBy}" ${order}) AS rn,`;
      }
    } else {
      orderByCaluse = `ROW_NUMBER() OVER (ORDER BY g."${orderBy}" ${order}) AS rn,`;
    }

    let searchClause;
    if (safeSearchTerm) {
      // searchClause = `AND CAST("g"."keyword" AS TEXT) LIKE '${safeSearchTerm}'`;
      searchClause = `AND "g"."keyword" ILIKE '${safeSearchTerm}'`;
    } else {
      searchClause = '';
    }

    if (isTrending !== true) {
      trendingGraphs = await prisma.graph.count({
        where: {
          historyId,
          trending: true,
          keyword: {
            contains: search,
            mode: 'insensitive',
          },
        },
      });
      totalGraphs = await prisma.graph.count({
        where: {
          historyId,
          keyword: {
            contains: search,
            mode: 'insensitive',
          },
        },
      });

      graphsQuery = `
      WITH "GraphsForHistory" AS (
          SELECT
              g.*,
              ${orderByCaluse}
              json_agg(
                  json_build_object(
                      'id', ms."id",
                      'month', ms."month",
                      'searchVolume', ms."searchVolume",
                      'year', ms."year"
                  )
              ) FILTER (WHERE ms."id" IS NOT NULL) AS "MonthlySearches",
              json_agg(
                  json_build_object(
                      'id', l."id",
                      'userId', l."userId",
                      'graphId', l."graphId"
                  )
              ) FILTER (WHERE l."id" IS NOT NULL) AS "Likes"
          FROM "Graph" g
          LEFT JOIN "MonthlySearch" ms ON ms."graphId" = g."id"
          LEFT JOIN "Like" l ON l."graphId" = g."id"
          WHERE g."historyId" = ${historyId} ${searchClause}
          GROUP BY g."id"
      )
      SELECT
          h.*,
          (
              SELECT json_agg(row_to_json("GraphsForHistory"))
              FROM (
                  SELECT * FROM "GraphsForHistory"
                  WHERE rn > ${skip} AND rn <= ${skip} + ${take}
              ) "GraphsForHistory"
          ) AS "Graph"
      FROM "History" h
      WHERE h."id" = ${historyId};
      `;
    } else {
      graphsQuery = `
    WITH "GraphsForHistory" AS (
    SELECT
        g.*,
        ROW_NUMBER() OVER (ORDER BY g."${orderBy}" ${order}) AS rn,
        json_agg(
            json_build_object(
                'id', ms."id",
                'month', ms."month",
                'searchVolume', ms."searchVolume",
                'year', ms."year"
            )
        ) FILTER (WHERE ms."id" IS NOT NULL) AS "MonthlySearches",
        json_agg(
            json_build_object(
                'id', l."id",
                'userId', l."userId",
                'graphId', l."graphId"
            )
        ) FILTER (WHERE l."id" IS NOT NULL) AS "Likes"
    FROM "Graph" g
    LEFT JOIN "MonthlySearch" ms ON ms."graphId" = g."id"
    LEFT JOIN "Like" l ON l."graphId" = g."id"
    WHERE g."historyId" = ${historyId} AND (g."trending" = 'true' OR g."volumeGrowth" >= 500)
    GROUP BY g."id"
)
SELECT
    h.*,
    (
        SELECT json_agg(row_to_json("GraphsForHistory"))
        FROM (
            SELECT * FROM "GraphsForHistory"
            WHERE rn > ${skip} AND rn <= ${skip} + ${take}
        ) "GraphsForHistory"
    ) AS "Graph"
FROM "History" h
WHERE h."id" = ${historyId};
`;

      trendingGraphs = await prisma.graph.count({
        where: {
          historyId,
          trending: true,
          keyword: {
            contains: search,
            mode: 'insensitive',
          },
        },
      });
      totalGraphs = await prisma.graph.count({
        where: {
          historyId,
          trending: true,
          keyword: {
            contains: search,
            mode: 'insensitive',
          },
        },
      });
    }

    const result = await prisma.$queryRawUnsafe(graphsQuery);
    const tempHistory = result[0];
    tempHistory.Graph.forEach((item) => {
      item.MonthlySearches.sort((a, b) => a.id - b.id);
    });
    // ******************* raw query **********************
    const history = {
      ...tempHistory,
      totalGraphs,
      trendingGraphs,
    };
    return res.status(200).json(history);
  } catch (error) {
    next(error);
  }
});

//************* */ previous graph api before applying raw query

// try {
//   // let graphInclude = {
//   //   skip,
//   //   take,

//   //   include: {
//   //     MonthlySearches: {
//   //       orderBy: {
//   //         id: 'asc',
//   //       },
//   //       select: {
//   //         id: true,
//   //         month: true,
//   //         searchVolume: true,
//   //         year: true,
//   //       },
//   //     },
//   //     Like: true,
//   //   },
//   // };

//   let totalGraphs;

//   // if (isTrending === true) {
//   //   graphInclude = {
//   //     ...graphInclude,
//   //     where: {
//   //       trending: true,
//   //       OR: [
//   //         {
//   //           keyword: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           competition: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           cpc: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           tagName: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //       ],
//   //     },
//   //   };
//   //   // Query the total number of Graph objects for the specified historyId
//   //   totalGraphs = await prisma.graph.count({
//   //     where: {
//   //       historyId,
//   //       trending: true,
//   //       OR: [
//   //         {
//   //           keyword: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           competition: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           cpc: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           tagName: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //       ],
//   //     },
//   //   });
//   // } else {
//   //   totalGraphs = await prisma.graph.count({
//   //     where: {
//   //       historyId,
//   //       OR: [
//   //         {
//   //           keyword: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           competition: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           cpc: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           tagName: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //       ],
//   //     },
//   //   });
//   // }
//   // if (!graphInclude.where && search) {
//   //   graphInclude = {
//   //     ...graphInclude,
//   //     where: {
//   //       OR: [
//   //         {
//   //           keyword: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           competition: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           cpc: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //         {
//   //           tagName: {
//   //             contains: search,
//   //             mode: 'insensitive',
//   //           },
//   //         },
//   //       ],
//   //     },
//   //   };
//   // }
//   // console.log('this is loged in>>>>>>>', graphInclude);
//   const tempHistory = await prisma.history.findFirst({
//     where: {
//       id: historyId,
//     },
//     include: {
//       Graph: {
//         skip,
//         take,

//         include: {
//           MonthlySearches: {
//             orderBy: {
//               id: 'asc',
//             },
//             select: {
//               id: true,
//               month: true,
//               searchVolume: true,
//               year: true,
//             },
//           },
//           Like: true,
//         },
//         orderBy: {
//           [orderBy]: orderBy && order ? order : undefined,
//         },
//       },
//     },
//   });

//   const trendingGraphs = await prisma.graph.count({
//     where: {
//       historyId,
//       trending: true,
//       OR: [
//         {
//           keyword: {
//             contains: search,
//             mode: 'insensitive',
//           },
//         },
//         {
//           competition: {
//             contains: search,
//             mode: 'insensitive',
//           },
//         },
//         {
//           cpc: {
//             contains: search,
//             mode: 'insensitive',
//           },
//         },
//         {
//           tagName: {
//             contains: search,
//             mode: 'insensitive',
//           },
//         },
//       ],
//     },
//   });

//   const history = {
//     ...tempHistory,
//     totalGraphs,
//     trendingGraphs,
//   };
//   return res.status(200).json(history);
// } catch (error) {
//   next(error);
// }
//**************** */ previous graph api before applying raw query

// router.get("/graph", verifyToken, async (req, res, next) => {
//   const historyId = parseInt(req.query.historyId);
//   const skip = parseInt(req.query.skip) || 0;
//   const take = parseInt(req.query.take) || 30;
//   const { isTrending } = req.query;

//   try {
//     const tempHistory = await prisma.history.findFirst({
//       where: {
//         id: historyId,
//       },
//       include: {
//         Graph: {
//           skip,
//           take,
//           orderBy: {
//             searchVolume: "desc",
//           },
//           include: {
//             MonthlySearches: {
//               orderBy: {
//                 id: "asc",
//               },
//               select: {
//                 id: true,
//                 month: true,
//                 searchVolume: true,
//                 year: true,
//               },
//             },
//             Like: true,
//           },
//         },
//       },
//     });

//     // Query the total number of Graph objects for the specified historyId
//     const totalGraphs = await prisma.graph.count({
//       where: {
//         historyId,
//       },
//     });
//     const history = {
//       ...tempHistory,
//       totalGraphs,
//     };
//     return res.status(200).json(history);
//   } catch (error) {
//     next(error);
//   }
// });

module.exports = router;
