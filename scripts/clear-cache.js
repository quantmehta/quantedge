/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.portfolioUpload.deleteMany({});
    console.log("Cleared PortfolioUpload cache.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
