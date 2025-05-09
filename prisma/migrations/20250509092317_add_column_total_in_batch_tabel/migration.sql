/*
  Warnings:

  - Added the required column `total_data` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_duplicated` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_inserted` to the `Batch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "total_data" INTEGER NOT NULL,
ADD COLUMN     "total_duplicated" INTEGER NOT NULL,
ADD COLUMN     "total_inserted" INTEGER NOT NULL;
