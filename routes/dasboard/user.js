const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../auth/verifyToken');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

router.post('/create-user', verifyToken, async (req, res, next) => {
  try {
    const { email, password, username, plan, amountPaid } = req.body;
    const { id: userId } = req.user;

    if (!email || !password || !username || !plan || !amountPaid) {
      return res.status(400).json({
        message: `These fields are required "email, password, username, plan, amountPaid"`,
      });
    }

    const isAdmin = await prisma.user.findFirst({
      where: {
        id: +userId,
        deleted: false,
        Role: 'ADMIN',
      },
    });

    if (!isAdmin) {
      return res.status(400).json({ message: 'Only admin is allowed!' });
    }
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

    // check whether the plan exists
    const planExists = [
      'TrendSwell.ai Brand (LTD)',
      'TrendSwell.ai Startup (LTD)',
    ].includes(plan);

    if (!planExists) {
      return res.status(400).json({
        message: `Plan should be one of them "TrendSwell.ai Brand (LTD)" or "TrendSwell.ai Startup (LTD)"`,
      });
    }

    let searchesAlloted = null;
    let allotedSearchRemainings = null;
    let priceId = null;

    if (plan === 'TrendSwell.ai Startup (LTD)') {
      searchesAlloted = 15;
      allotedSearchRemainings = 15;
      priceId = 'price_1NZPOnC8GSaILaWugl5p0xDO';
    } else if (plan === 'TrendSwell.ai Brand (LTD)') {
      searchesAlloted = 50;
      allotedSearchRemainings = 50;
      priceId = 'price_1NZPmrC8GSaILaWubjhVB7Jy';
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
            amountPaid, //cents to dollars
            currency: 'usd',
            billingPeriod: null,
            priceId,
            timestampCreated: 1691625621,
            productName: plan,
            sessionId: 'null',
            searchesAlloted,
            lifeTime: true,
            allotedSearchRemainings,
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

router.get('/user', verifyToken, async (req, res, next) => {
  try {
    const { email } = req.body;
    const { id: userId } = req.user;

    const isAdmin = await prisma.user.findFirst({
      where: {
        id: +userId,
        deleted: false,
        Role: 'ADMIN',
      },
    });

    if (!isAdmin) {
      return res.status(400).json({ message: 'Only admin is allowed!' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        deleted: false,
      },
      include: {
        Plan: {
          where: {
            status: true,
          },
        },
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

router.post('/update-user', verifyToken, async (req, res, next) => {
  try {
    const { deleted, searches, verificationStatus, username, email } = req.body;
    const { id: userId } = req.user;

    if (!userId) {
      return res.status(400).json({
        message:
          'userId is required (check whether you are sending admin token or not)',
      });
    }

    const isAdmin = await prisma.user.findFirst({
      where: {
        id: +userId,
        deleted: false,
        Role: 'ADMIN',
      },
    });

    if (!isAdmin) {
      return res.status(400).json({ message: 'Only admin is allowed!' });
    }

    // only working for LTD not subscription (just check this query for subscriptions)
    const userExisted = await prisma.user.findFirst({
      where: {
        email,
        deleted: false,
      },
      include: {
        Plan: {
          where: {
            status: true,
          },
        },
      },
    });

    if (!userExisted) {
      return res.status(400).json({ message: 'User not exists!' });
    }
    let user;
    if (deleted) {
      user = await prisma.user.update({
        where: {
          id: userExisted.id,
        },
        data: {
          deleted,
        },
      });

      return res.status(200).json({
        message: 'User deleted successfully!',
        user,
      });
    }

    if (typeof verificationStatus === 'string' || username) {
      user = await prisma.user.update({
        where: { id: userExisted.id },
        data: {
          ...(verificationStatus !== null || verificationStatus !== undefined
            ? { verified: verificationStatus === 'true' ? true : false }
            : {}),
          ...(username ? { username } : {}),
        },
      });

      return res.status(200).json({
        message: 'User updated successfully!',
        user,
      });
    }

    if ((searches && !userExisted.Plan) || userExisted.Plan.length === 0) {
      return res.status(400).json({ message: 'User does not have any plan!' });
    }

    let plan;
    if (searches) {
      plan = await prisma.plan.update({
        where: {
          id: userExisted.Plan[0].id,
        },
        data: {
          searchesAlloted:
            userExisted.Plan[0].searchesAlloted + Number(searches),
          allotedSearchRemainings:
            userExisted.Plan[0].allotedSearchRemainings + Number(searches),
        },
      });
    }

    return res.status(200).json({
      message: 'User updated successfully!',
      user,
      plan,
    });
  } catch (error) {
    console.log('error', error);
    next(error);
  }
});

router.post('/add-plan', verifyToken, async (req, res) => {
  try {
    const { plan, email, amountPaid } = req.body;
    const { id: userId } = req.user;

    const isAdmin = await prisma.user.findFirst({
      where: {
        id: +userId,
        deleted: false,
        Role: 'ADMIN',
      },
    });

    if (!isAdmin) {
      return res.status(400).json({ message: 'Only admin is allowed!' });
    }

    const today = dayjs();

    const userExisted = await prisma.user.findFirst({
      where: {
        email,
        deleted: false,
      },
    });

    if (!userExisted) {
      return res
        .status(400)
        .json({ message: `User not exists with this email "${email}"` });
    }

    // check whether the plan exists
    const planExists = [
      'TrendSwell.ai Brand (LTD)',
      'TrendSwell.ai Startup (LTD)',
    ].includes(plan);

    if (!planExists) {
      return res.status(400).json({
        message: `Plan should be one of them "TrendSwell.ai Brand (LTD)" or "TrendSwell.ai Startup (LTD)"`,
      });
    }

    let searchesAlloted = null;
    let allotedSearchRemainings = null;
    let priceId = null;

    if (plan === 'TrendSwell.ai Startup (LTD)') {
      searchesAlloted = 15;
      allotedSearchRemainings = 15;
      priceId = 'price_1NZPOnC8GSaILaWugl5p0xDO';
    } else if (plan === 'TrendSwell.ai Brand (LTD)') {
      searchesAlloted = 50;
      allotedSearchRemainings = 50;
      priceId = 'price_1NZPmrC8GSaILaWubjhVB7Jy';
    }

    const user = await prisma.user.update({
      where: { id: userExisted.id },
      data: {
        verified: true,
        subscriptionStatus: true,
        Plan: {
          create: {
            amountPaid: amountPaid.toString(), //cents to dollars
            currency: 'usd',
            billingPeriod: null,
            priceId,
            timestampCreated: 1691625621,
            productName: plan,
            sessionId: 'null',
            searchesAlloted,
            lifeTime: true,
            allotedSearchRemainings,
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

    return res
      .status(200)
      .json({ message: 'Plan updated successfully!', user });
  } catch (error) {
    console.log('error in adding plan===>>>', error);
    return res.status(500).json({ message: 'Internal Server Error!', error });
  }
});

module.exports = router;
