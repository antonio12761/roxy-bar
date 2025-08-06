const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testMenuDB() {
  try {
    console.log('Testing menu database...')
    
    // Test MenuGroup
    const groups = await prisma.menuGroup.findMany()
    console.log(`✅ Found ${groups.length} menu groups`)
    
    // Test MenuCategory
    const categories = await prisma.menuCategory.findMany()
    console.log(`✅ Found ${categories.length} menu categories`)
    
    // Test MenuItem
    const items = await prisma.menuItem.findMany()
    console.log(`✅ Found ${items.length} menu items`)
    
    // Test MenuVariant
    const variants = await prisma.menuVariant.findMany()
    console.log(`✅ Found ${variants.length} menu variants`)
    
    console.log('\n📊 Database is working correctly!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testMenuDB()