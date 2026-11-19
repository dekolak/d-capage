-- Parcours (plusieurs leçons) ou page (un contenu seul). Les cours existants deviennent des parcours.
-- AlterTable
ALTER TABLE "CoursAcademie" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'parcours';

