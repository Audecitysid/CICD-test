const router = require('express').Router();
const verifyToken = require('../auth/verifyToken');
const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

//stripe payment
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', verifyToken, async (req, res, next) => {
  const { priceId, lifeTime } = req.body;
  const { id: userId } = req.user;

  try {
    const plan = await prisma.plan.findFirst({
      where: {
        userId,
        status: true,
        subscribed: true,
      },
    });

    if (plan) {
      return res.status(403).json({ message: 'you already have a plan' });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      allow_promotion_codes: 'true',
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          // For metered billing, do not pass quantity
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        priceId,
      },
      mode: lifeTime ? 'payment' : 'subscription',
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&lifeTime=${lifeTime}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

router.get('/update-payment-status', verifyToken, async (req, res, next) => {
  const { sessionId } = req.query;
  const lifeTime = req.query.lifeTime === 'true' ? true : false;
  const { id: userId } = req.user;

  try {
    const plan = await prisma.plan.findFirst({
      where: {
        userId,
        status: true,
        subscribed: true,
      },
    });

    if (plan) {
      return res.send();
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!lifeTime) {
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription
      );

      const plan = subscription.plan;
      const {
        interval,
        amount,
        created,
        currency,
        id: priceId,
        product: productId,
      } = plan;
      // const createdDate = dayjs.unix(created).format("YYYY-MM-DD HH:mm:ss");
      const createdDate = dayjs().format('YYYY-MM-DD HH:mm:ss');

      // Determine the interval duration
      let intervalDuration;
      if (interval === 'month') {
        intervalDuration = 1; // 1 month
      } else if (interval === 'year') {
        intervalDuration = 1; // 1 year
      }

      // Calculate the expiration date based on the interval
      const expirationDate = dayjs(createdDate)
        .add(intervalDuration, interval)
        .format('YYYY-MM-DD HH:mm:ss');

      const product = await stripe.products.retrieve(productId);
      const { name: productName } = product;
      const startup_MonthSearches = 30;
      const brand_MonthSearches = 100;

      let searchesAlloted;
      let allotedSearchRemainings;
      let totalSearches;
      let totalSearchesRemainings;

      if (productName === 'startup' && interval === 'month') {
        searchesAlloted = startup_MonthSearches;
        allotedSearchRemainings = startup_MonthSearches;
        totalSearches = startup_MonthSearches;
        totalSearchesRemainings = 0;
      } else if (productName === 'startup' && interval === 'year') {
        searchesAlloted = startup_MonthSearches;
        allotedSearchRemainings = startup_MonthSearches;
        totalSearches = startup_MonthSearches * 12; //years searches
        totalSearchesRemainings =
          startup_MonthSearches * 12 - startup_MonthSearches; //subtracting 1 month
      } else if (productName === 'brand' && interval === 'month') {
        searchesAlloted = brand_MonthSearches;
        allotedSearchRemainings = brand_MonthSearches;
        totalSearches = brand_MonthSearches;
        totalSearchesRemainings = 0;
      } else if (productName === 'brand' && interval === 'year') {
        searchesAlloted = brand_MonthSearches;
        allotedSearchRemainings = brand_MonthSearches;
        totalSearches = brand_MonthSearches * 12; //years searches
        totalSearchesRemainings =
          brand_MonthSearches * 12 - brand_MonthSearches; //subtracting 1 month
      }

      await prisma.user.update({
        where: {
          id: Number(userId),
        },
        data: {
          subscriptionStatus: true,
          Plan: {
            create: {
              amountPaid: (amount / 100).toString(), //cents to dollars
              currency,
              billingPeriod: interval,
              priceId,
              timestampCreated: created,
              productName,
              sessionId,
              searchesAlloted,
              allotedSearchRemainings,
              totalSearches,
              totalSearchesRemainings,
              customerId: subscription.customer,
              createdAt: new Date(createdDate),
              updatedAt: new Date(createdDate),
              expiresAt: new Date(expirationDate),
            },
          },
        },
      });

      const user = await prisma.user.findFirst({
        where: {
          id: Number(userId),
        },
        include: {
          Plan: true,
        },
      });

      return res
        .status(200)
        .json({ message: 'You have successfully purchased your plan' });
    } else {
      const price = await stripe.prices.retrieve(session.metadata.priceId);
      const product = await stripe.products.retrieve(price.product);
      let searchesAlloted;
      console.log('productName', product.name);
      let allotedSearchRemainings;
      if (product?.name === 'TrendSwell.ai Startup (LTD)') {
        searchesAlloted = 15;
        allotedSearchRemainings = 15;
      } else if (product?.name === 'TrendSwell.ai Brand (LTD)') {
        searchesAlloted = 50;
        allotedSearchRemainings = 50;
      }
      //for testing db
      if (product?.name === 'brand lifetime') {
        searchesAlloted = 50;
        allotedSearchRemainings = 50;
      }

      const createdDate = dayjs
        .unix(session.created)
        .format('YYYY-MM-DD HH:mm:ss');

      await prisma.user.update({
        where: {
          id: Number(userId),
        },
        data: {
          subscriptionStatus: true,
          Plan: {
            create: {
              amountPaid: (session.amount_total / 100).toString(), //cents to dollars
              currency: session.currency,
              billingPeriod: null,
              priceId: session.metadata.priceId,
              timestampCreated: session.created,
              productName: product.name,
              sessionId,
              searchesAlloted,
              lifeTime: true,
              allotedSearchRemainings,
              totalSearches: null,
              totalSearchesRemainings: null,
              customerId: null,
              createdAt: new Date(createdDate),
              updatedAt: new Date(createdDate),
              expiresAt: null,
            },
          },
        },
      });

      return res
        .status(200)
        .json({ message: 'You have successfully purchased your plan' });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/manage-subscription', verifyToken, async (req, res, next) => {
  // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
  // Typically this is stored alongside the authenticated user in your database.
  const { id: userId } = req.user;
  try {
    const plan = await prisma.plan.findFirst({
      where: {
        userId,
        status: true,
      },
    });

    if (!plan) {
      return res.status(403).json({ message: 'plan not found' });
    }

    const { sessionId } = plan;
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // This is the url to which the customer will be redirected when they are done
    // managing their billing with the portal.
    const returnUrl = process.env.BASE_URL;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkoutSession.customer,
      return_url: returnUrl,
    });
    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
