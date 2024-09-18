const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../../auth/verifyToken');
const path = require('path');
const XLSX = require('xlsx');
const MainJobService = require('../../../BullMQ/services/mainJobService');

const filePath = path.join(__dirname, 'currentai-categories.xlsx');

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

const prisma = new PrismaClient();

router.post('/create', verifyToken, async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    // getting category ticker form backend
    const categories = await loadExcel({ sheetNumber: 0 });
    categories.shift();

    for (const category of categories) {
      const categorieAlreadyExist = await prisma.category.findFirst({
        where: {
          name: category[0],
        },
      });
      const subCategoryAlreadyExist = await prisma.subCategory.findFirst({
        where: {
          name: category[1],
        },
      });
      if (categorieAlreadyExist) {
        if (!subCategoryAlreadyExist) {
          await prisma.subCategory.create({
            data: {
              name: category[1],
              Category: { connect: { id: categorieAlreadyExist?.id } },
            },
          });
        } else {
          console.log(`SubCategory "${category[1]}" already exist!`);
        }
        console.log(`Category "${category[0]}" already exist!`);
      } else {
        await prisma.category.create({
          data: {
            name: category[0],
            SubCategory: { create: { name: category[1] } },
            User: { connect: { id: userId } },
          },
        });
      }
    }

    return res
      .status(200)
      .json({ message: 'category added successfully!', categories });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error!', error });
  }
});

router.post('/', verifyToken, async (req, res, next) => {
  const { Role, id: userId } = req.user;
  const { name } = req.body;

  try {
    if (Role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admin is allowed' });
    }

    await prisma.category.create({
      data: {
        name,
        User: {
          connect: {
            id: Number(userId),
          },
        },
      },
    });

    return res.status(200).json({ message: 'category created successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/', verifyToken, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        SubCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
});

router.get('/all', verifyToken, async (req, res, next) => {
  const { categoryName } = req.query;

  // Initialize query conditions and parameters
  let conditions = [];
  let queryParams = [];
  let paramIndex = 1; // Start parameter indexing from 1

  if (categoryName) {
    conditions.push(`c.name ILIKE $${paramIndex}`);
    queryParams.push(`%${categoryName}%`);
    paramIndex++;
  }

  // Combine conditions with 'AND'
  let whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Construct the SQL query dynamically with parameterized query
    const query = `
      SELECT 
        c.id AS categoryId, 
        c.name AS categoryName, 
        COALESCE(SUM(sc.graphCount), 0) AS totalGraphCount
      FROM "Category" c
      LEFT JOIN (
        SELECT 
          sc.id,
          sc.name,
          sc."categoryId",
          COUNT(g.id) AS graphCount
        FROM "SubCategory" sc
        LEFT JOIN "_GraphToSubCategory" gsc ON sc.id = gsc."B"
        LEFT JOIN "Graph" g ON gsc."A" = g.id AND g."trendDb" = true
        GROUP BY sc.id
      ) sc ON c.id = sc."categoryId"
      ${whereClause}
      GROUP BY c.id;
    `;

    // Execute the query with parameters
    const result = await prisma.$queryRawUnsafe(query, ...queryParams);
    const count = await prisma.category.count({
      where: { name: { contains: categoryName, mode: 'insensitive' } },
    });
    return res.status(200).json({ count, result });
  } catch (error) {
    console.log('error in category while getting graph count>>>>>>>..', error);
    next(error);
  }
});

module.exports = router;
