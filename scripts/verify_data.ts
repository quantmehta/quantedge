
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DB Data Integrity Verification (LTP Fix) ---');

    const lastUpload = await prisma.portfolioUpload.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!lastUpload) {
        console.log('No uploads found.');
        return;
    }

    console.log(`Checking Upload ID: ${lastUpload.id} (${lastUpload.originalFilename})`);

    const holdings = await prisma.holding.findMany({
        where: { portfolioUploadId: lastUpload.id },
        include: { instrument: { include: { prices: { orderBy: { asOf: 'desc' }, take: 1 } } } },
        orderBy: { rowNumber: 'asc' }
    });

    console.log('\nResolution Results (First 30 Rows):');
    holdings.slice(0, 30).forEach(h => {
        const ltpRes = h.instrument?.prices?.[0]?.price;
        const ltp = ltpRes !== undefined ? ltpRes.toString() : 'NONE';
        console.log(`Row ${h.rowNumber}: [${h.rawIdentifier}] -> Symbol: ${h.instrument?.identifier || 'UNRESOLVED'}, Price: ${ltp}`);
    });

    const unresolvedCount = holdings.filter(h => !h.resolvedInstrumentId).length;
    console.log(`\nUnresolved Count: ${unresolvedCount} / ${holdings.length}`);

    // Specifically check for 'Archean'
    const archean = holdings.find(h => h.rawIdentifier.toLowerCase().includes('archean'));
    if (archean) {
        console.log(`\nSpecific Check - Archean:`);
        console.log(`  Row: ${archean.rowNumber}`);
        console.log(`  Resolution: ${archean.instrument?.identifier || 'FAILED'}`);
        console.log(`  Price: ${archean.instrument?.prices?.[0]?.price || 'N/A'}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
