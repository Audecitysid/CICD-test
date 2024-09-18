const { PrismaClient } = require('@prisma/client');
const { doStuff } = require('../../utils/gpt/bullmq.utils');
const { addReRunJob } = require('../jobhelper');
const dayjs = require('dayjs');

const prisma = new PrismaClient();
const prompt = `
I have provided you a list of subcategories, And a list of keywords you need to send me data in json format the keyword is lying under which subcategory.

for example: 
[
"Retail": ["keyword1", keyword2"],
]

Just provide me an array of subcategories with nested array of keywords. No captions at all
and please provide me full array, continue generating by yourself if answer is long

Sub Categories List: 
Retail
Productivity
Supply Chain & Logistics
Marketing
Cybersecurity
Human Resources
Legal
Real Estate
Workplace
AI
Blockchain
Programming
Robotics
Automation
Virtual reality
Telecommunication
Makeup & Cosmetics
Skin Care 
Hair Care
Fragrances
Fitness & Exercise
Sleep
Personal Care
Vitamins & Supplements
Nutrition
Pharma
Healthcare
Mental Health
Diets
Furniture
Home Décor
Kitchen
Garden
Gaming
Sports & Outdoors
Streaming
Media
Toys & Games
Clothing
Shoes
Jewelry
Investing
Cryptocurrency
Personal Finance
Insurance
Banking
Wealth Management
Cooking & Recipes
Food
Alcohol
Beverages
Grocery
Manufacturing
Automotive
Energy
Construction
Design
Travel
Dating & Relationships
Social Media
Art
Sustainability
Education
Baby Care
Pets
`;
const MainJobService = async (countdata) => {
  try {
    const count = await prisma.graph.count({
      where: {
        trending: true,
        searchVolume: { gte: 20 },
        SubCategory: { none: {} },
      },
    });
    // console.log('count>>>>>>>>>>>>>.', count);
    if (count > 100) {
      const graphs = await prisma.graph.findMany({
        where: {
          trending: true,
          searchVolume: { gte: 20 },
          SubCategory: { none: {} },
        },
        select: {
          keyword: true,
        },
        take: 100,
      });

      const keywords = graphs?.map((graph) => graph.keyword);

      const stuf = await doStuff(keywords, prompt);
      const data = JSON.parse(stuf);

      for (const [subcategoryName, graphNames] of Object.entries(data)) {
        let subcategory = await prisma.subCategory.findFirst({
          where: { name: subcategoryName },
          select: { id: true, name: true, categoryId: true },
        });

        for (const graphName of graphNames) {
          let graphByname = await prisma.graph.findFirst({
            where: { keyword: graphName },
          });
          if (graphByname && subcategory) {
            try {
              const addedAtTd = dayjs().toISOString();
              await prisma.graph.update({
                where: { id: graphByname?.id },
                data: {
                  SubCategory: { connect: { id: subcategory.id } },
                  trendDb: true,
                  addedAtTd,
                },
                select: {
                  id: true,
                  volumeGrowth: true,
                  keyword: true,
                  userId: true,
                },
              });
            } catch (err) {
              console.log('main job err>>>', err);
            }
          }
        }
      }
      console.log(
        'this job is completed >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>',
        data
      );
      await addReRunJob({
        data: count,
        delay: 60000,
      });
    } else if (count < 100 && count > 0) {
      const graphs = await prisma.graph.findMany({
        where: {
          trending: true,
          searchVolume: { gte: 20 },
          SubCategory: { none: {} },
        },
        select: {
          keyword: true,
        },
        take: 100,
      });

      const keywords = graphs?.map((graph) => graph.keyword);

      const stuf = await doStuff(keywords, prompt);
      const data = JSON.parse(stuf);
      console.log('data>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', data);
      for (const [subcategoryName, graphNames] of Object.entries(data)) {
        let subcategory = await prisma.subCategory.findFirst({
          where: { name: subcategoryName },
        });

        for (const graphName of graphNames) {
          let graph = await prisma.graph.findFirst({
            where: { keyword: graphName },
          });
          if (graph && subcategory) {
            const addedAtTd = dayjs().toISOString();
            await prisma.graph.update({
              where: { id: graph.id },
              data: {
                SubCategory: { connect: { id: subcategory.id } },
                trendDb: true,
                addedAtTd,
              },
            });
          }
        }
      }
      console.log('this job is completed >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    }
    return JSON.parse(stuf);
  } catch (err) {
    return err.message;
  }
};

module.exports = MainJobService;
