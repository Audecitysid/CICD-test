const router = require('express').Router();
const verifyToken = require('../auth/verifyToken');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const dayjs = require('dayjs');
const { calculateYoYGrowth } = require('../../utils/gpt/gpt.utils');

const prisma = new PrismaClient();

const calculateSlope = (data) => {
  const n = data.length;
  let sumXY = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXSquare = 0;

  for (const { month, year, search_volume } of data) {
    const x = year * 12 + month;
    const y = parseInt(search_volume);

    sumXY += x * y;
    sumX += x;
    sumY += y;
    sumXSquare += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXSquare - sumX * sumX);
  return slope;
};

// Function to calculate the mean of an array
const calculateMean = (arr) => {
  const sum = arr.reduce((total, value) => total + value, 0);
  return sum / arr.length;
};

// Function to calculate the standard deviation of an array
const calculateStandardDeviation = (arr) => {
  const mean = calculateMean(arr);
  const differences = arr.map((value) => value - mean);
  const squaredDifferences = differences.map((difference) => difference ** 2);
  const variance =
    squaredDifferences.reduce((total, value) => total + value, 0) / arr.length;
  return Math.sqrt(variance);
};

// Function to remove outliers from the data
const removeOutliers = (data, threshold) => {
  const searchVolumes = data.map((item) => parseInt(item.search_volume));
  const mean = calculateMean(searchVolumes);
  const standardDeviation = calculateStandardDeviation(searchVolumes);
  const lowerThreshold = mean - threshold * standardDeviation;
  const upperThreshold = mean + threshold * standardDeviation;

  const filteredData = data.filter((item) => {
    const searchVolume = parseInt(item.search_volume);
    return searchVolume >= lowerThreshold && searchVolume <= upperThreshold;
  });

  return filteredData;
};

const DataSEO = async (keywords, languageCode, locationCode) => {
  const filteredKeywords = keywords.filter(
    (str) => str !== '' && str !== undefined
  );
  //console.log('DataseoKeywords=========>', filteredKeywords);

  // checking while data of previous month is yet available or nots
  let resultData;
  await axios({
    method: 'get',
    url: 'https://api.dataforseo.com/v3/keywords_data/google_ads/status',
    auth: {
      username: 'jack@getcurrent.ai',
      password: process.env.DATA_SEO_PASSWORD,
    },
    headers: {
      'content-type': 'application/json',
    },
  })
    .then(function (response) {
      resultData = response['data']['tasks'][0]['result'];
    })
    .catch(function (error) {
      console.log('error', error);
    });

  const today = dayjs();
  const fourYearsAgo = today.subtract(4, 'year').toISOString();
  const lastMonthNumber = today.subtract(1, 'month').month();
  let lastDayOfMonth;
  if (resultData.last_month_in_monthly_searches === lastMonthNumber) {
    lastDayOfMonth = today.subtract(1, 'month').endOf('month');
  } else {
    lastDayOfMonth = today.subtract(2, 'month').endOf('month');
  }
  const fourYearsAgoFormat = dayjs(fourYearsAgo).format('YYYY-MM-DD');
  const lastDayOfPreviousMonth = lastDayOfMonth.format('YYYY-MM-DD');
  const post_array = [];
  post_array.push({
    date_from: fourYearsAgoFormat,
    date_to: lastDayOfPreviousMonth,
    search_partners: false,
    keywords: filteredKeywords,
    location_code: locationCode,
    language_code: languageCode,
    sort_by: 'search_volume',
  });

  // wrap the Axios call in a Promise
  return new Promise((resolve, reject) => {
    axios({
      method: 'post',
      url: 'https://api.dataforseo.com/v3/keywords_data/google/search_volume/live',
      auth: {
        username: 'jack@getcurrent.ai',
        password: process.env.DATA_SEO_PASSWORD,
      },
      data: post_array,
      headers: {
        'content-type': 'application/json',
      },
    })
      .then(function (response) {
        const result = response['data']['tasks'];
        resolve(result); // resolve with the data
      })
      .catch(function (error) {
        //console.log(error);
        reject(error); // reject with the error
      });
  });
};

router.get('/search-confirmation', verifyToken, async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const user = await prisma.user.findFirst({
      where: {
        id: Number(userId),
      },
      include: {
        Plan: {
          where: {
            status: true,
          },
        },
      },
    });

    // checking whether the subscription exists
    if (!user.subscriptionStatus) {
      return res
        .status(200)
        .json({ message: 'You donot have plan', subScriptionStatus: false });
    }

    const userPlan = user.Plan[0];
    if (!userPlan.lifeTime) {
      // checking whether expiry date arrives
      const currentDate = dayjs();
      const isExceeded = currentDate.isAfter(userPlan?.expiresAt);
      if (isExceeded) {
        await prisma.user.update({
          where: {
            id: Number(userId),
          },
          data: {
            subscriptionStatus: false,
            Plan: {
              update: {
                where: {
                  id: Number(userPlan.id),
                },
                data: {
                  status: false,
                  totalSearchesRemainings: 0,
                  subscribed: false,
                },
              },
            },
          },
        });

        return res.status(403).json({
          message: 'Your plan limit is exceeded',
          subScriptionStatus: false,
        });
      }

      if (
        userPlan.billingPeriod === 'year' &&
        userPlan.totalSearchesRemainings !== 0
      ) {
        const oneMonthAfter = dayjs(userPlan.updatedAt).add(1, 'month');
        const formattedAfterMonth = oneMonthAfter.format('YYYY-MM-DD HH:mm:ss');

        const hasOneMonthPassed = dayjs(currentDate).isAfter(oneMonthAfter);
        if (hasOneMonthPassed) {
          await prisma.plan.update({
            where: {
              id: userPlan.id,
            },
            data: {
              totalSearchesRemainings:
                userPlan.totalSearchesRemainings - userPlan.searchesAlloted,
              allotedSearchRemainings: userPlan.searchesAlloted,
              updatedAt: new Date(formattedAfterMonth),
            },
          });
        }
      }
    } else {
      // check whether month is passed so we reassign the searches
      const currentDate = dayjs();
      // Calculate the end of month
      const monthEnd = dayjs(userPlan?.updatedAt)
        .add(1, 'month')
        .format('YYYY-MM-DD HH:mm:ss');
      const monthPassed = currentDate.isAfter(monthEnd);

      if (monthPassed) {
        await prisma.plan.update({
          where: {
            id: userPlan.id,
          },
          data: {
            allotedSearchRemainings: userPlan.searchesAlloted,
            updatedAt: new Date(currentDate.format('YYYY-MM-DD HH:mm:ss')),
          },
        });
      }
    }

    const plan = await prisma.plan.findFirst({
      where: {
        id: userPlan.id,
      },
    });

    const { allotedSearchRemainings, searchesAlloted, status } = plan;

    return res.status(200).json({
      allotedSearchRemainings,
      searchesAlloted,
      subScriptionStatus: status,
    });
  } catch (error) {
    next(error);
  }
});

const createGraphs = async ({
  res,
  next,
  graphData,
  finalTagsWithoutInvalidChars,
  searchText,
  userId,
  goal,
  aiStrength,
  region,
}) => {
  console.log(
    `aiStrength,
        goal,
        region`,
    aiStrength,
    goal,
    region
  );
  try {
    const history = await prisma.history.create({
      data: {
        searchKeyword: searchText,
        aiStrength,
        goal,
        region,
        User: {
          connect: {
            id: userId,
          },
        },
      },
    });

    await Promise.all(
      graphData[0].result?.map(async (tag, index) => {
        if (Object.keys(tag)?.length !== 0) {
          try {
            const tagName = finalTagsWithoutInvalidChars.find(
              (item) => item.keyword === tag?.keyword
            )?.dummyTag;

            if (tag?.search_volume) {
              const volumeGrowth = calculateYoYGrowth(tag?.monthly_searches);

              const filteredData = removeOutliers(tag?.monthly_searches, 2);
              const slope = calculateSlope(filteredData);

              const createGraph = await prisma.graph.create({
                data: {
                  competition: tag?.competition + '',
                  cpc: tag?.cpc + '',
                  volumeGrowth,
                  searchVolume: parseInt(tag?.search_volume),
                  keyword: tag?.keyword + '',
                  tagName,
                  pinned: tag?.keyword.toString() == searchText ? true : false,
                  trending:
                    parseInt(tag?.search_volume) > 10 && slope > 0
                      ? true
                      : false,
                  History: {
                    connect: {
                      id: history.id,
                    },
                  },
                  User: {
                    connect: {
                      id: userId,
                    },
                  },

                  ...(tag?.monthly_searches?.length > 0
                    ? {
                        MonthlySearches: {
                          createMany: {
                            data: tag?.monthly_searches?.map((search) => ({
                              month: search.month,
                              year: search.year,
                              searchVolume: search?.search_volume + '',
                            })),
                          },
                        },
                      }
                    : {}),
                },
              });
              return createGraph;
            }
          } catch (error) {
            console.log('error 123:', error);
            next(error);
          }
        }
      })
    );

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        Plan: {
          where: {
            status: true,
          },
        },
      },
    });

    await prisma.plan.update({
      where: {
        id: Number(user.Plan[0].id),
      },
      data: {
        allotedSearchRemainings: user.Plan[0].allotedSearchRemainings - 1,
      },
    });

    return res.status(200).json({ graphCreated: true, historyId: history.id });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

router.patch('/data-op', verifyToken, async (req, res, next) => {
  const {
    uniqueKeywords,
    finalTagsWithoutInvalidChars,
    searchText,
    languageCode,
    locationName,
    countryIsoCode,
    goal,
    aiStrength,
    locationCode,
  } = req.body;
  const { id: userId } = req.user;
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        Plan: true,
      },
    });

    if (user.Plan.searchesAlloted <= 0) {
      return res
        .status(403)
        .json({ message: 'Sorry, you have used your searches for this month' });
    }
    const graphData = await DataSEO(
      uniqueKeywords,
      languageCode,
      +locationCode
    );

    await createGraphs({
      res,
      next,
      graphData,
      finalTagsWithoutInvalidChars,
      userId,
      searchText,
      goal,
      aiStrength,
      region: locationName,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/graph', verifyToken, async (req, res, next) => {
  const userId = req.user.id;
  const { graphData, finalTagsWithoutInvalidChars, searchText } = req.body;

  try {
    const history = await prisma.history.create({
      data: {
        searchKeyword: searchText,
        User: {
          connect: {
            id: userId,
          },
        },
      },
    });

    await Promise.all(
      graphData[0].result?.map(async (tag, index) => {
        if (Object.keys(tag)?.length !== 0) {
          try {
            const tagName = finalTagsWithoutInvalidChars.find(
              (item) => item.keyword === tag?.keyword
            )?.dummyTag;

            if (tag?.search_volume) {
              const volumeGrowth = calculateYoYGrowth(tag?.monthly_searches);
              const filteredData = removeOutliers(tag?.monthly_searches, 2);
              const slope = calculateSlope(filteredData);

              const createGraph = await prisma.graph.create({
                data: {
                  competition: tag?.competition + '',
                  cpc: tag?.cpc + '',
                  volumeGrowth,
                  searchVolume: parseInt(tag?.search_volume),
                  keyword: tag?.keyword + '',
                  tagName,
                  pinned: tag?.keyword.toString() == searchText ? true : false,
                  trending:
                    parseInt(tag?.search_volume) > 10 && slope > 0
                      ? true
                      : false,
                  History: {
                    connect: {
                      id: history.id,
                    },
                  },
                  User: {
                    connect: {
                      id: userId,
                    },
                  },

                  ...(tag?.monthly_searches?.length > 0
                    ? {
                        MonthlySearches: {
                          createMany: {
                            data: tag?.monthly_searches?.map((search) => ({
                              month: search.month,
                              year: search.year,
                              searchVolume: search?.search_volume + '',
                            })),
                          },
                        },
                      }
                    : {}),
                },
              });
              return createGraph;
            }
          } catch (error) {
            console.log('error 123:', error);
            next(error);
          }
        }
      })
    );

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        Plan: {
          where: {
            status: true,
          },
        },
      },
    });

    await prisma.plan.update({
      where: {
        id: Number(user.Plan[0].id),
      },
      data: {
        allotedSearchRemainings: user.Plan[0].allotedSearchRemainings - 1,
      },
    });

    return res.status(200).json({ graphCreated: true, historyId: history.id });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post('/user-plan', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        email,
        deleted: false,
      },
      include: {
        Plan: true,
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'User not exists!' });
    }

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/alot', async (req, res) => {
  try {
    const { planId, searchesAlloted, allotedSearchRemainings } = req.body;

    const plan = await prisma.plan.update({
      where: {
        id: +planId,
      },
      data: {
        allotedSearchRemainings,
        searchesAlloted,
      },
    });

    if (!plan) {
      return res.status(400).json({ message: 'plan not exists!' });
    }

    return res.status(200).json(plan);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
