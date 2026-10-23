import { S3Client, CreateBucketCommand, PutBucketWebsiteCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { getBucketRegion } from "@aws-sdk/s3-request-presigner";

/**
 * Deploy static site to S3
 */
export async function deployToS3({
  accessKeyId,
  secretAccessKey,
  region,
  repoUrl,
  branch,
  repoName,
  buildCommand,
  outputDirectory,
  log,
  bucketName,
}) {
  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    // Create bucket name if not provided
    const finalBucketName = bucketName || `${repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`;
    
    await log(`📦 Creating S3 bucket: ${finalBucketName}...`);
    
    // Try to create bucket (may fail if exists, that's ok)
    try {
      await s3Client.send(new CreateBucketCommand({
        Bucket: finalBucketName,
        ...(region !== "us-east-1" && { CreateBucketConfiguration: { LocationConstraint: region } }),
      }));
      await log(`✅ Bucket created successfully`);
    } catch (err) {
      if (err.name !== "BucketAlreadyExists" && err.name !== "BucketAlreadyOwnedByYou") {
        throw err;
      }
      await log(`ℹ️ Bucket already exists, using existing bucket`);
    }

    // Enable static website hosting
    await log(`🌐 Configuring static website hosting...`);
    try {
      await s3Client.send(new PutBucketWebsiteCommand({
        Bucket: finalBucketName,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: "index.html" },
          ErrorDocument: { Key: "index.html" }, // SPA support
        },
      }));
      await log(`✅ Website hosting configured`);
    } catch (err) {
      await log(`⚠️ Failed to configure website hosting: ${err.message}`);
    }

    // Set bucket policy for public read access
    await log(`🔓 Setting bucket policy for public access...`);
    const bucketPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${finalBucketName}/*`,
        },
      ],
    };

    try {
      await s3Client.send(new PutBucketPolicyCommand({
        Bucket: finalBucketName,
        Policy: JSON.stringify(bucketPolicy),
      }));
      await log(`✅ Bucket policy set for public access`);
    } catch (err) {
      await log(`⚠️ Failed to set bucket policy: ${err.message}`);
    }

    // Get files from repository
    // For now, we'll clone and build locally, then upload
    // In production, you might want to use GitHub Actions or build in a container
    await log(`📥 Cloning repository...`);
    const { execSync } = require("child_process");
    const tmpDir = `/tmp/deploy-${Date.now()}`;
    
    try {
      execSync(`mkdir -p ${tmpDir}`, { stdio: "inherit" });
      execSync(`git clone -b ${branch} ${repoUrl} ${tmpDir}/repo`, { stdio: "inherit" });
      
      const repoPath = `${tmpDir}/repo${outputDirectory ? `/${outputDirectory}` : ""}`;
      
      // Build if needed
      if (buildCommand) {
        await log(`🔨 Building application...`);
        execSync(`cd ${tmpDir}/repo && ${buildCommand}`, { stdio: "inherit" });
      }
      
      // Upload files to S3
      await log(`☁️ Uploading files to S3...`);
      const fs = require("fs");
      const path = require("path");
      
      async function uploadDirectory(dirPath, s3Prefix = "") {
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const file of files) {
          const fullPath = path.join(dirPath, file.name);
          const s3Key = s3Prefix ? `${s3Prefix}/${file.name}` : file.name;
          
          if (file.isDirectory()) {
            await uploadDirectory(fullPath, s3Key);
          } else {
            const fileContent = fs.readFileSync(fullPath);
            const contentType = getContentType(file.name);
            
            await s3Client.send(new PutObjectCommand({
              Bucket: finalBucketName,
              Key: s3Key,
              Body: fileContent,
              ContentType: contentType,
              CacheControl: file.name.endsWith(".html") ? "no-cache" : "public, max-age=31536000",
            }));
            
            await log(`  ✓ Uploaded: ${s3Key}`);
          }
        }
      }
      
      await uploadDirectory(repoPath);
      
      // Cleanup
      execSync(`rm -rf ${tmpDir}`, { stdio: "inherit" });
      
      await log(`✅ Deployment complete!`);
      
      // Generate website URL
      const websiteUrl = region === "us-east-1"
        ? `http://${finalBucketName}.s3-website-us-east-1.amazonaws.com`
        : `http://${finalBucketName}.s3-website-${region}.amazonaws.com`;
      
      return {
        bucketName: finalBucketName,
        websiteUrl,
        region,
        success: true,
      };
    } catch (err) {
      // Cleanup on error
      try {
        execSync(`rm -rf ${tmpDir}`, { stdio: "inherit" });
      } catch {}
      throw err;
    }
  } catch (error) {
    await log(`❌ S3 deployment failed: ${error.message}`);
    throw error;
  }
}

function getContentType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const types = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    webp: "image/webp",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
  };
  return types[ext] || "application/octet-stream";
}

