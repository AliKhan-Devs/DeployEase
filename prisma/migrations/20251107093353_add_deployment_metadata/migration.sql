/*
  Warnings:

  - Added the required column `repoName` to the `Deployment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repoUrl` to the `Deployment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Deployment" DROP CONSTRAINT "Deployment_projectId_fkey";

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "branch" TEXT NOT NULL DEFAULT 'main',
ADD COLUMN     "ec2InstanceId" TEXT,
ADD COLUMN     "ec2PublicIp" TEXT,
ADD COLUMN     "keyMaterial" TEXT,
ADD COLUMN     "keyPairName" TEXT,
ADD COLUMN     "repoName" TEXT NOT NULL,
ADD COLUMN     "repoUrl" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
