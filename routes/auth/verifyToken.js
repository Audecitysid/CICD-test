const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function verifyToken(req, res, next) {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    const id = decoded.id;

    const validUser = await prisma.user.findFirst({
      where: {
        id,
      },
    });

    if (!validUser) {
      return res.status(401).json({ message: 'Invalid user!' });
    }

    if (validUser.deleted) {
      return res.status(401).json({ message: 'user not exists' });
    }

    // we are assigning the user id to req.user so we can access in the routes like console.log(req.user)
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(400).json({ message: 'invalid token!' });
  }
}

module.exports = verifyToken;
