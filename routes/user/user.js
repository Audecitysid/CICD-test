const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../auth/verifyToken');
const path = require('path');
const XLSX = require('xlsx');
const dayjs = require('dayjs');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

router.get('/plan-status', verifyToken, async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const plan = await prisma.plan.findFirst({
      where: {
        userId,
        status: true,
      },
      select: {
        status: true,
        subscribed: true,
        lifeTime: true,
        productName: true,
      },
    });

    console.log('userId', userId);

    if (!plan) {
      return res.status(500).json({ subscribed: false });
    }

    return res.status(200).json(plan);
  } catch (error) {
    next(error);
  }
});

const filePath = path.join(__dirname, 'Keylitic-LTD-customers.xlsx');

const loadExcel = async ({ sheetNumber }) => {
  console.log('i am about to start');
  // Load the workbook
  const workbook = XLSX.readFile(filePath);

  // Select the first sheet in the workbook
  const sheetName = workbook.SheetNames[sheetNumber];
  const worksheet = workbook.Sheets[sheetName];

  // Convert worksheet data to JSON format
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return data;
};

// add manual user
// router.post("/manual", async (req, res, next) => {
//   try {
//     const result = await loadExcel({ sheetNumber: 0 });
//     result.shift();

//     // const uniqueElements = new Set();
//     // const results = [];

//     // // Loop through the input array to filter unique elements
//     // for (const element of result) {
//     //   const key = element[2];
//     //   if (!uniqueElements.has(key)) {
//     //     uniqueElements.add(key);
//     //     results.push(element);
//     //   }
//     // }

//     await Promise.all(
//       result?.map(
//         async (user) =>
//           await prisma.user.create({
//             data: {
//               email: user[2],
//               password: "welcometogetcurrentai",
//               username: `${user[0]} ${user[1]}`,
//               verified: true,
//               subscriptionStatus: true,
//               Plan: {
//                 create: {
//                   amountPaid: "499", //cents to dollars
//                   currency: "usd",
//                   billingPeriod: null,
//                   priceId: "price_1NZPmrC8GSaILaWubjhVB7Jy",
//                   timestampCreated: 1691625621,
//                   productName: "TrendSwell.ai Brand (LTD)",
//                   sessionId: "null",
//                   searchesAlloted: 50,
//                   lifeTime: true,
//                   allotedSearchRemainings: 50,
//                   totalSearches: null,
//                   totalSearchesRemainings: null,
//                   customerId: null,
//                   createdAt: new Date("2023-08-10T00:00:21.000Z"),
//                   updatedAt: new Date("2023-08-10T00:00:21.000Z"),
//                   expiresAt: null,
//                 },
//               },
//             },
//           })
//       )
//     );
//     return res.status(200).json({ message: "user added successfuly" });
//   } catch (error) {
//     next(error);
//   }
// });

router.get('/hashing-password', async (req, res) => {
  try {
    const { password } = req.body;
    // hashing password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    return res.status(200).json({ hashedPassword });
  } catch (error) {
    return res.status(400).json({ error });
  }
});

router.post('/manual/single-user', async (req, res, next) => {
  try {
    console.log('manual/single-user running');
    const { email, password, searches, username } = req.body;

    // hashing password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const today = dayjs();

    const existed = await prisma.user.findFirst({
      where: {
        email,
        deleted: false,
      },
    });

    if (existed) {
      return res.status(400).json({ message: 'User already exists!' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
        verified: true,
        subscriptionStatus: true,
        Plan: {
          create: {
            amountPaid: '499', //cents to dollars
            currency: 'usd',
            billingPeriod: null,
            priceId: 'price_1NZPmrC8GSaILaWubjhVB7Jy',
            timestampCreated: 1691625621,
            productName: 'TrendSwell.ai Brand (LTD)',
            sessionId: 'null',
            searchesAlloted: +searches,
            lifeTime: true,
            allotedSearchRemainings: +searches,
            totalSearches: null,
            totalSearchesRemainings: null,
            customerId: null,
            createdAt: today.toISOString(),
            updatedAt: today.toISOString(),
            expiresAt: null,
          },
        },
      },
    });
    return res.status(200).json({ message: 'User added successfuly!', user });
  } catch (error) {
    next(error);
  }
});

router.post('/pschange', async (req, res, next) => {
  try {
    const user = await prisma.user.findMany({
      where: {
        password: 'welcometogetcurrentai',
      },
    });

    if (user.length > 0) {
      await Promise.all(
        user?.map(
          async (item) =>
            await prisma.user.update({
              where: {
                id: item.id,
              },
              data: {
                password:
                  '$2a$10$H99vy0JnoCyCvP477sgAme8fUH37xLXNnxwUyxVPu9n1c1QX4/NR2',
              },
            })
        )
      );
    }

    // const uniqueElements = new Set();
    // const results = [];

    // // Loop through the input array to filter unique elements
    // for (const element of result) {
    //   const key = element[2];
    //   if (!uniqueElements.has(key)) {
    //     uniqueElements.add(key);
    //     results.push(element);
    //   }
    // }

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
