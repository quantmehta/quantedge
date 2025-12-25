-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "magnitudePct" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "horizon" TEXT NOT NULL,
    "affectedScopeType" TEXT NOT NULL,
    "affectedScopeValue" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "EventImpactRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runEventImpactId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "holdingValue" REAL NOT NULL,
    "sensitivity" REAL NOT NULL,
    "magnitudePct" REAL NOT NULL,
    "rawImpact" REAL NOT NULL,
    "confidenceWeightedImpact" REAL NOT NULL,
    "priceTimestampMs" BIGINT,
    CONSTRAINT "EventImpactRow_runEventImpactId_fkey" FOREIGN KEY ("runEventImpactId") REFERENCES "RunEventImpact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleSeverity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunOverride_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RunEventImpact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "eventListJson" TEXT,
    "impactSummaryJson" TEXT,
    "holdingImpactJson" TEXT,
    "traceJson" TEXT,
    "eventJson" TEXT,
    "impactJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEventImpact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RunEventImpact" ("createdAt", "eventJson", "id", "impactJson", "runId") SELECT "createdAt", "eventJson", "id", "impactJson", "runId" FROM "RunEventImpact";
DROP TABLE "RunEventImpact";
ALTER TABLE "new_RunEventImpact" RENAME TO "RunEventImpact";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "EventImpactRow_runEventImpactId_eventId_holdingId_key" ON "EventImpactRow"("runEventImpactId", "eventId", "holdingId");
