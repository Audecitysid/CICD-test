const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../../auth/verifyToken');

const prisma = new PrismaClient();

router.post('/', verifyToken, async (req, res, next) => {
  const { Role } = req.user;
  const { name, categoryId } = req.body;
  try {
    if (Role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admin is allowed' });
    }

    // check category exists
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      return res.status(403).json({ message: 'Category not found' });
    }

    await prisma.subCategory.create({
      data: {
        name,
        Category: {
          connect: {
            id: Number(categoryId),
          },
        },
      },
    });

    return res
      .status(200)
      .json({ message: 'sub-category created Successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/', verifyToken, async (req, res, next) => {
  const { skip = 0, take = 10, subCategoryId, search = '' } = req.query;
  try {
    const count = await prisma.graph.count({
      where: {
        keyword: { contains: search, mode: 'insensitive' },
        ...(subCategoryId && { SubCategory: { some: { id: +subCategoryId } } }),
      },
    });

    const isSubcategory = await prisma.graph.findMany({
      where: {
        keyword: { contains: search, mode: 'insensitive' },
        ...(subCategoryId && { SubCategory: { some: { id: +subCategoryId } } }),
      },
      skip,
      take,
    });
    if (!isSubcategory) {
      return res.status(400).json({ message: 'sub-category not exist!' });
    }
    return res.status(200).json({
      isSubcategory,
      count,
      nextFrom: count >= take + skip ? take + skip : false,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/by-cat-id', verifyToken, async (req, res, next) => {
  const { categoryId } = req.query;
  if (!categoryId) {
    return res.status(400).json({ message: 'categoryId is required!' });
  }
  try {
    const count = await prisma.subCategory.count({
      where: { categoryId: +categoryId },
    });
    const data = await prisma.subCategory.findMany({
      where: { categoryId: +categoryId },
      select: {
        id: true,
        name: true,
        _count: { select: { Graph: { where: { trendDb: true } } } },
      },
    });

    return res.status(200).json({ count, data });
  } catch (error) {
    console.log('error in category while getting graph count>>>>>>>..', error);
    next(error);
  }
});

module.exports = router;
