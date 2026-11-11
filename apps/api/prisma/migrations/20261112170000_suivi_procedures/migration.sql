-- CreateTable
CREATE TABLE "SignalementEtape" (
    "id" TEXT NOT NULL,
    "etapeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "traite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalementEtape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviParcours" (
    "id" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "reponses" JSONB NOT NULL DEFAULT '{}',
    "faites" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "derniere" TEXT,
    "fin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuiviParcours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalementEtape_etapeId_traite_idx" ON "SignalementEtape"("etapeId", "traite");

-- CreateIndex
CREATE UNIQUE INDEX "SuiviParcours_session_key" ON "SuiviParcours"("session");

-- CreateIndex
CREATE INDEX "SuiviParcours_procedureId_idx" ON "SuiviParcours"("procedureId");

-- AddForeignKey
ALTER TABLE "SignalementEtape" ADD CONSTRAINT "SignalementEtape_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeProcedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalementEtape" ADD CONSTRAINT "SignalementEtape_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviParcours" ADD CONSTRAINT "SuiviParcours_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

