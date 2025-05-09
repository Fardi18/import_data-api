/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Admin` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Admin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_name_key" ON "Admin"("name");
