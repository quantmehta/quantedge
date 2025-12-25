-- CreateTable
CREATE TABLE "PortfolioUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalFilename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileHashSha256" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "rowCount" INTEGER,
    "status" TEXT NOT NULL,
    "validationJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioUploadId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawIdentifier" TEXT NOT NULL,
    "resolvedInstrumentId" TEXT,
    "name" TEXT,
    "quantity" DECIMAL NOT NULL,
    "costPrice" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "assetClass" TEXT,
    "sector" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holding_portfolioUploadId_fkey" FOREIGN KEY ("portfolioUploadId") REFERENCES "PortfolioUpload" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Holding_resolvedInstrumentId_fkey" FOREIGN KEY ("resolvedInstrumentId") REFERENCES "Instrument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifierType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "exchange" TEXT,
    "sector" TEXT,
    "assetClass" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstrumentMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawIdentifier" TEXT NOT NULL,
    "uploadId" TEXT,
    "instrumentId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstrumentMapping_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentId" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "asOf" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "MarketPrice_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketPriceEod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "close" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "MarketPriceEod_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ruleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RulesetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulesetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definitionJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RulesetVersion_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "Ruleset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioUploadId" TEXT NOT NULL,
    "rulesetVersionId" TEXT,
    "status" TEXT NOT NULL,
    "asOfMarketTimestamp" DATETIME,
    "failureReason" TEXT,
    "auditJson" TEXT,
    "auditSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Run_portfolioUploadId_fkey" FOREIGN KEY ("portfolioUploadId") REFERENCES "PortfolioUpload" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Run_rulesetVersionId_fkey" FOREIGN KEY ("rulesetVersionId") REFERENCES "RulesetVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunScenario_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunEventImpact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "eventJson" TEXT NOT NULL,
    "impactJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEventImpact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "assetInstrumentId" TEXT,
    "resultJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Standard',
    "storedPath" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_identifier_key" ON "Instrument"("identifier");

-- CreateIndex
CREATE INDEX "InstrumentMapping_rawIdentifier_idx" ON "InstrumentMapping"("rawIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_instrumentId_asOf_source_key" ON "MarketPrice"("instrumentId", "asOf", "source");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceEod_instrumentId_date_source_key" ON "MarketPriceEod"("instrumentId", "date", "source");
