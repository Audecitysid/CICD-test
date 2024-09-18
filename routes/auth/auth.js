const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  resetPasswordValidation,
} = require('../../validation');
const verifyToken = require('./verifyToken');
const nodemailer = require('nodemailer');
const { validationResult } = require('express-validator');
const { body } = require('express-validator');

const prisma = new PrismaClient();

// // Send the reset password email
// const transporter = nodemailer.createTransport({
//   // Configure your email service provider here
//   host: "server72.web-hosting.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: "help@support.getcurrent.ai",
//     pass: process.env.EMAIL_PASSWORD,
//   },
// });
// Send the reset password email
const transporter = nodemailer.createTransport({
  // Configure your email service provider here
  host: 'server350.web-hosting.com',
  port: 465,
  secure: true,
  auth: {
    user: 'support@trendswell.ai',
    pass: process.env.EMAIL_PASSWORD,
  },
});

function generateRandomNumber() {
  const timestamp = Date.now().toString(); // Get the current timestamp as a string
  const shuffledString = shuffleString(timestamp); // Shuffle the string
  const randomNumber = shuffledString.substring(0, 6); // Extract the first 6 characters

  return randomNumber;
}

// Function to shuffle a string
function shuffleString(str) {
  const arr = str.split(''); // Convert string to an array of characters
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Generate random index
    [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap characters
  }
  return arr.join(''); // Convert array back to string
}

// Function to send an email
async function sendEmail(mailOptions) {
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    throw new Error(error?.response || 'Error sending mail');
  }
}

router.post('/signup', async (req, res, next) => {
  const { username, email, password, preSelectPkg, preLifeTimePkg, role } =
    req.body;

  console.log('req.body========>', req.body);
  try {
    registerValidation(req.body, res);

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        deleted: false,
      },
    });

    if (user) {
      return res.status(500).json({
        message: `An account with "${email}" already exists`,
        userExists: true,
      });
    }

    // hashing password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const randomSixDigitNumber = generateRandomNumber();

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
        verifyCode: randomSixDigitNumber.toString(),
        preSelectPkg,
        Role: role && role.toUpperCase(),
        preLifeTimePkg:
          preLifeTimePkg && preLifeTimePkg === 'true' ? true : false,
      },
    });

    // creating token and assigning
    const token = jwt.sign({ id: newUser.id }, process.env.TOKEN_SECRET);
    // const resetUrl = `${process.env.BASE_URL}/code-verification?token=${token}&verifyCode=${randomSixDigitNumber}`;

    const mailOptions = {
      from: 'support@trendswell.ai',
      to: email,
      subject: 'TrendSwell account verification',
      html: `<h1>Your verification code is: </h1><h2>${randomSixDigitNumber}</h2>`,
    };

    try {
      // yahan se await khd hataya ha
      sendEmail(mailOptions);
      return res.status(200).json({
        token,
        message: 'Account verification link sent to your email address',
      });
    } catch (error) {
      return res.status(500).json({ message: error.toString() });
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/email-verification',
  [body('email').isEmail().withMessage('Invalid email address')],
  async (req, res, next) => {
    const errors = validationResult(req);
    const { email } = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // check whether user exists
      const userExisted = await prisma.user.findFirst({
        where: {
          email,
          deleted: false,
        },
      });

      if (userExisted.verified) {
        return res.status(400).json({ message: 'you are already verified' });
      }

      const randomSixDigitNumber = generateRandomNumber();
      await prisma.user.update({
        where: {
          id: userExisted.id,
        },
        data: {
          verifyCode: randomSixDigitNumber.toString(),
        },
      });
      // creating token and assigning
      const token = jwt.sign({ id: userExisted.id }, process.env.TOKEN_SECRET);

      // const resetUrl = `${process.env.BASE_URL}/code-verification?token=${token}&verifyCode=${randomSixDigitNumber}`;

      const mailOptions = {
        from: 'support@trendswell.ai',
        to: email,
        subject: 'TrendSwell account verification',
        html: `<h1>Your account verification code is: </h1><h2>${randomSixDigitNumber}</h2>`,
      };

      try {
        await sendEmail(mailOptions);
        return res.status(200).json({
          token,
          message: 'Account verification link sent to your email address',
        });
      } catch (error) {
        return res.status(500).json({ message: error.toString() });
      }
    } catch (error) {
      next(error);
    }
  }
);

router.post('/code-verification', async (req, res, next) => {
  const token = req.header('auth-token');
  const { verifyCode } = req.body;

  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    // verify code is available or not in request body
    verifyEmailValidation(req.body, res);

    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    const userId = decoded.id;
    const userExisted = await prisma.user.findFirst({
      where: {
        id: userId,
        deleted: false,
      },
    });
    if (!userExisted) {
      return res.status(400).json({ message: `user not exists` });
    }

    if (userExisted.verifyCode === verifyCode) {
      await prisma.user.update({
        where: {
          id: userExisted.id,
        },
        data: {
          verified: true,
        },
      });
      if (userExisted.preSelectPkg) {
        const sendUserData = {
          email: userExisted.email,
          token,
          subscriptionStatus: userExisted.subscriptionStatus,
        };

        const pkgDetails = {
          priceId: userExisted.preSelectPkg,
          lifeTime: userExisted.preLifeTimePkg,
        };

        return res.header('auth-token', token).status(200).json({
          message: 'Account verified successfully.',
          sendUserData,
          pkgDetails,
        });
      } else {
        return res
          .status(200)
          .json({ message: 'Account verified successfully.' });
      }
    } else {
      return res
        .status(401)
        .json({ message: 'Verification code is incorrect' });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // validating user data
    loginValidation(req.body, res);

    //   checking whehter the user exists
    const userExisted = await prisma.user.findFirst({
      where: { email, deleted: false },
    });
    if (!userExisted)
      return res.status(400).json({
        message: 'invalid email or password',
        // for previour users (donot remove this line)
        verified: 'temp true',
      });

    console.log('userExited===>>>', userExisted);

    // check whether the user is valid or not
    if (!userExisted.verified) {
      return res
        .status(403)
        .json({ message: 'please verify your account first', verified: false });
    }

    //   checking the password
    const validPassword = await bcrypt.compare(password, userExisted.password);
    if (!validPassword)
      return res.status(400).json({
        message: 'invalid email or password',
        // for previour users (donot remove this line)
        verified: 'temp true',
      });

    // creating token and assigning
    const token = jwt.sign(
      { id: userExisted.id, Role: userExisted.Role },
      process.env.TOKEN_SECRET
    );

    const sendUserData = {
      email: userExisted.email,
      token,
      subscriptionStatus: userExisted.subscriptionStatus,
    };

    return res.header('auth-token', token).status(200).json(sendUserData);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Invalid email address')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(401).json({ message: 'Please enter email' });
    }

    try {
      // Check if the email exists in the database
      const user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(), // Convert email to lowercase for case-insensitive search
          deleted: false,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: `Account will this email "${email}" is not exists`,
        });
      }

      // creating token and assigning
      const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET);

      const resetUrl = `${process.env.BASE_URL}/reset-password?token=${token}`;
      const mailOptions = {
        from: 'support@trendswell.ai',
        to: email,
        subject: 'Password Reset',
        html: `Click the following link to reset your password: <a href="${resetUrl}">click here</a>`,
      };

      try {
        await sendEmail(mailOptions);
        return res.status(200).json({
          message:
            'Reset password link successfully sent to your email address',
        });
      } catch (error) {
        return res.status(500).json({ message: error });
      }
    } catch (err) {
      next(err);
    }
  }
);

router.patch('/reset-password', verifyToken, async (req, res, next) => {
  const userId = req.user.id;
  const { password } = req.body;
  try {
    // validating password
    resetPasswordValidation(req.body, res);

    // hashing password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    return res.status(200).json({ message: 'password updated successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/validate', verifyToken, async (req, res, next) => {
  const { id: userId } = req.user;
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deleted: false,
      },
    });

    if (!user) {
      return res.status(403).json({ message: 'user not exists' });
    }

    if (!user.verified) {
      return res
        .status(403)
        .json({ message: 'user is not verified', verified: false });
    }

    return res.status(200).json({ message: 'user is valid and verified' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
