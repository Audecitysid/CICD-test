const dayjs = require('dayjs');
const { doStuff } = require('../../utils/gpt/bullmq.utils');
const { PrismaClient } = require('@prisma/client');

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
async function ReCalling(data) {
  try {
    console.log('ReCalling function started with data:', data);

    if (data?.data >= 100) {
      try {
        console.log('shahmir is rerunning>>>>>>>>>>>>>>>>..:', data);
        let skip = 0;
        const take = 100; // Define how many records to fetch per iteration
        console.log('skip:', skip, 'take>>', take);
        const count = await prisma.graph.count({
          where: {
            trending: true,
            searchVolume: { gte: 20 },
            SubCategory: { none: {} },
          },
        });

        while (skip < count) {
          console.log(`Fetching records from ${skip} to ${skip + take}`);

          const graphs = await prisma.graph.findMany({
            where: {
              trending: true,
              searchVolume: { gte: 20 },
              SubCategory: { none: {} },
            },
            select: {
              keyword: true,
            },
            skip,
            take,
          });

          const keywords = graphs?.map((graph) => graph?.keyword);
          console.log('do stuff is calling>>>>>>>>>');
          const stuf = await doStuff(keywords, prompt);
          const data = JSON.parse(stuf);

          for (const [subcategoryName, graphNames] of Object.entries(data)) {
            let subcategory = await prisma.subCategory.findFirst({
              where: { name: subcategoryName },
              select: { id: true, categoryId: true },
            });
            console.log('sub cat>>>>>', subcategory);

            for (const graphName of graphNames) {
              let graph = await prisma.graph.findFirst({
                where: { keyword: graphName },
              });
              if (graph && subcategory) {
                try {
                  const addedAtTd = dayjs().toISOString();
                  await prisma.graph.update({
                    where: { id: graph.id },
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
                  console.log('err>>>>>>>>.', err);
                }
              }
            }
          }

          skip += take; // Move to the next batch
        }

        if (count < 100 && count > 0) {
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
            });

            for (const graphName of graphNames) {
              let graph = await prisma.graph.findFirst({
                where: { keyword: graphName },
              });
              if (graph && subcategory) {
                const addedAtTd = dayjs().toISOString();
                const updatedGraph = await prisma.graph.update({
                  where: { id: graph.id },
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
              }
            }
          }
        }
        return JSON.parse(stuf);
      } catch (err) {
        return err.message;
      }
    }

    console.log('completed is rerunning>>>>>>>>>>>>>>>>..:');
  } catch (error) {
    console.error('Error in ReCalling function:', error);
    throw error;
  }
}

module.exports = { ReCalling };
