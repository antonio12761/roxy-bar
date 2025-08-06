import { prisma } from '../lib/db';

async function testCategoryIcon() {
  try {
    console.log('Testing CategoryIcon model...');
    
    // Check if model exists
    const count = await prisma.categoryIcon.count();
    console.log(`Found ${count} CategoryIcon records`);
    
    // Try to create one if none exist
    if (count === 0) {
      const created = await prisma.categoryIcon.create({
        data: {
          categoryName: 'TEST',
          icon: '🧪',
          color: '#FF0000'
        }
      });
      console.log('Created test CategoryIcon:', created);
    }
    
    // List all
    const all = await prisma.categoryIcon.findMany();
    console.log('All CategoryIcons:', all);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCategoryIcon();