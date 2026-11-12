-- CreateTable
CREATE TABLE "PlanEntretien" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntretien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacheEntretien" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "frequence" INTEGER NOT NULL DEFAULT 3,
    "unite" TEXT NOT NULL DEFAULT 'MOIS',
    "bientotJours" INTEGER NOT NULL DEFAULT 15,
    "procedureId" TEXT,
    "photo" TEXT NOT NULL DEFAULT 'non',
    "photoConsigne" TEXT,
    "technicien" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TacheEntretien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntretienFait" (
    "id" TEXT NOT NULL,
    "userMachineId" TEXT NOT NULL,
    "tacheId" TEXT,
    "userId" TEXT NOT NULL,
    "parAdmin" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'client',
    "titre" TEXT,
    "note" TEXT,
    "photoCle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntretienFait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ModeleToPlanEntretien" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ModeleToPlanEntretien_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "EntretienFait_userMachineId_date_idx" ON "EntretienFait"("userMachineId", "date");

-- CreateIndex
CREATE INDEX "_ModeleToPlanEntretien_B_index" ON "_ModeleToPlanEntretien"("B");

-- AddForeignKey
ALTER TABLE "TacheEntretien" ADD CONSTRAINT "TacheEntretien_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanEntretien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheEntretien" ADD CONSTRAINT "TacheEntretien_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienFait" ADD CONSTRAINT "EntretienFait_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "UserMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienFait" ADD CONSTRAINT "EntretienFait_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "TacheEntretien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienFait" ADD CONSTRAINT "EntretienFait_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModeleToPlanEntretien" ADD CONSTRAINT "_ModeleToPlanEntretien_A_fkey" FOREIGN KEY ("A") REFERENCES "Modele"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModeleToPlanEntretien" ADD CONSTRAINT "_ModeleToPlanEntretien_B_fkey" FOREIGN KEY ("B") REFERENCES "PlanEntretien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

