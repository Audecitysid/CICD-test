const router = require('express').Router();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

//stripe payment
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// webhook
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (request, response) => {
    let event;
    const payload = request.body;
    const signature = request.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }

    let subscription;
    let status;
    // Handle the event
    switch (event.type) {
      case 'customer.subscription.trial_will_end':
        console.log('========= customer.subscription.trial_will_end =========');
        subscription = event.data.object;
        status = subscription.status;
        // Then define and call a method to handle the subscription trial ending.
        // handleSubscriptionTrialEnding(subscription);
        break;
      case 'customer.subscription.deleted':
        subscription = event.data.object;
        status = subscription.status;
        console.log(`cancelled_plan Subscription status is ${status}.`);
        // Then define and call a method to handle the subscription deleted.
        // handleSubscriptionDeleted(subscriptionDeleted);
        break;
      case 'customer.subscription.created':
        console.log('========= customer.subscription.created =========');
        console.log('event.data====>', event.data);
        subscription = event.data.object;
        status = subscription.status;
        // Then define and call a method to handle the subscription created.
        // handleSubscriptionCreated(subscription);
        break;
      case 'customer.subscription.updated':
        console.log('========= customer.subscription.updated =========');
        console.log('event======>', event.data);
        const plan = await prisma.plan.findFirst({
          where: {
            customerId: event.data.object.customer,
          },
        });

        console.log('plan=====>', plan);
        console.log('event.data=====>', event);

        if (plan) {
          if (event.data.object.cancel_at_period_end) {
            await prisma.plan.update({
              where: {
                id: plan.id,
              },
              data: {
                subscribed: false,
                canceled_at: event.data.object.canceled_at,
              },
            });
          }

          // you need to update this code. for renew plan you will continue the existing plan just. stripe will not charge user for new plan but giving their last plan which was accidentally cancelled or else
          if (
            plan?.canceled_at === event.data.previous_attributes.canceled_at
          ) {
            await prisma.plan.update({
              where: {
                id: plan.id,
              },
              data: {
                subscribed: true,
                status: true,
                totalSearches: plan.totalSearches,
                totalSearchesRemainings:
                  plan.totalSearchesRemainings - plan.searchesAlloted,
                searchesAlloted: plan.searchesAlloted,
                allotedSearchRemainings: plan.searchesAlloted,
                canceled_at: null,
              },
            });
          }
        }

        subscription = event.data.object;
        status = false;
        // Then define and call a method to handle the subscription update.
        // handleSubscriptionUpdated(subscription);
        break;
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`);
    }
    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

module.exports = router;
