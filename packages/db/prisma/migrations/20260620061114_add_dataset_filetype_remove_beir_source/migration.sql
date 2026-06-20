/*
  Warnings:

  - You are about to drop the column `beir_source` on the `documents` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "DocumentFiletype" ADD VALUE 'dataset';

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "beir_source";
