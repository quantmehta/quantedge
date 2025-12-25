import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const defaultRuleset = await prisma.ruleset.create({
        data: {
            name: 'Balanced Strategy',
            description: 'Standard risk-adjusted portfolio optimization rules.',
            versions: {
                create: {
                    version: 1,
                    isActive: true,
                    definitionJson: JSON.stringify({
                        maxSectorExposure: 0.25,
                        minCashBuffer: 0.05,
                        riskFreeRate: 0.045
                    })
                }
            }
        }
    })

    console.log({ defaultRuleset })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
