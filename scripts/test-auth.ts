#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const { hash, compare } = require("bcryptjs");

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log("🔍 Testing authentication for PREPARA users...\n");
    
    // Find PREPARA users
    const preparaUsers = await prisma.user.findMany({
      where: {
        ruolo: "PREPARA",
        attivo: true
      },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        password: true
      }
    });
    
    console.log(`Found ${preparaUsers.length} PREPARA users:\n`);
    
    for (const user of preparaUsers) {
      console.log(`👤 ${user.nome} ${user.cognome}`);
      console.log(`   Email: ${user.email}`);
      
      // Test password (assuming password = nome)
      const isValid = await compare(user.nome, user.password);
      console.log(`   Password "${user.nome}": ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      console.log("");
    }
    
    console.log("\n📝 To login as PREPARA user:");
    console.log("1. Go to /login");
    console.log("2. Enter password: Andrea (for Andrea) or Sara (for Sara)");
    console.log("3. You'll be redirected to /prepara");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testAuth().catch(console.error);
}

module.exports = { testAuth };