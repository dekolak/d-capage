-- CreateTable
CREATE TABLE "CoursAcademie" (
    "id" TEXT NOT NULL,
    "espace" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "couvertureCle" TEXT,
    "publie" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cibleCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cibleModeles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "etiquettes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursAcademie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeconAcademie" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "blocs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeconAcademie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulateurAcademie" (
    "id" TEXT NOT NULL,
    "espace" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "modeleId" TEXT,
    "cle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulateurAcademie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichierAcademie" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierAcademie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionAcademie" (
    "userId" TEXT NOT NULL,
    "leconId" TEXT NOT NULL,
    "termineLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionAcademie_pkey" PRIMARY KEY ("userId","leconId")
);

-- CreateIndex
CREATE INDEX "CoursAcademie_espace_idx" ON "CoursAcademie"("espace");

-- CreateIndex
CREATE INDEX "LeconAcademie_coursId_idx" ON "LeconAcademie"("coursId");

-- CreateIndex
CREATE INDEX "ProgressionAcademie_leconId_idx" ON "ProgressionAcademie"("leconId");

-- AddForeignKey
ALTER TABLE "LeconAcademie" ADD CONSTRAINT "LeconAcademie_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "CoursAcademie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionAcademie" ADD CONSTRAINT "ProgressionAcademie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionAcademie" ADD CONSTRAINT "ProgressionAcademie_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "LeconAcademie"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Académie ouverte aux clients existants de chaque espace (ceux qui ont déjà un module de l'espace)
INSERT INTO "UserModule" ("userId", "module")
SELECT DISTINCT um."userId", 'academie-lazzeko' FROM "UserModule" um
WHERE um."module" IN ('reglages-decapage', 'procedures-lazzeko')
ON CONFLICT DO NOTHING;

INSERT INTO "UserModule" ("userId", "module")
SELECT DISTINCT um."userId", 'academie-kiavik' FROM "UserModule" um
WHERE um."module" IN ('guide-flexiprint', 'guide-dxonjet', 'procedures-kiavik')
ON CONFLICT DO NOTHING;
