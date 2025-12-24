/**
 * Service Detection Utilities
 * 
 * Supports two modes:
 * 1. Manifest-based: Parse deployease.json from repository
 * 2. Auto-detection: Infer services from repository structure
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Parse deployease.json manifest file
 * @param {string} repoPath - Path to cloned repository
 * @returns {Array<ServiceConfig>|null} - Array of service configurations or null if not found
 */
export function parseManifest(repoPath) {
  const manifestPath = join(repoPath, "deployease.json");
  
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(content);

    // Validate manifest structure
    if (!manifest.services || !Array.isArray(manifest.services)) {
      throw new Error("Manifest must contain a 'services' array");
    }

    return manifest.services.map((service, index) => ({
      name: service.name || `service-${index + 1}`,
      displayName: service.displayName || service.name,
      repoSubPath: service.path || service.repoSubPath || "",
      appType: service.type || service.appType || "node",
      appPort: service.port || service.appPort || (service.type === "python" ? 8000 : 3000),
      entryPoint: service.entryPoint || service.mainfile,
      buildCommand: service.buildCommand,
      outputDirectory: service.outputDirectory || service.buildDir,
      envVars: service.env || service.envVars || "",
      deploymentType: service.deploymentType || (service.type === "static" || service.type === "react" ? "s3" : "ec2"),
      healthCheckPath: service.healthCheckPath || "/health",
      healthCheckPort: service.healthCheckPort,
      minInstances: service.minInstances || 1,
      maxInstances: service.maxInstances || 3,
      desiredInstances: service.desiredInstances || 1,
    }));
  } catch (error) {
    console.error("Failed to parse manifest:", error);
    throw new Error(`Invalid manifest file: ${error.message}`);
  }
}

/**
 * Auto-detect services from repository structure
 * @param {string} repoPath - Path to cloned repository
 * @returns {Array<ServiceConfig>} - Array of detected services
 */
export function autoDetectServices(repoPath) {
  const services = [];

  try {
    // Common monorepo patterns
    const commonDirs = ["services", "apps", "packages", "microservices", "api", "backend", "frontend"];

    for (const dir of commonDirs) {
      const dirPath = join(repoPath, dir);
      if (existsSync(dirPath)) {
        const subdirs = execSync(`ls -d ${dirPath}/*/ 2>/dev/null || true`, { encoding: "utf-8" })
          .split("\n")
          .filter(Boolean)
          .map(d => d.trim().replace(/\/$/, ""));

        for (const subdir of subdirs) {
          const serviceName = subdir.split("/").pop();
          const servicePath = subdir.replace(repoPath + "/", "");

          // Detect app type
          const packageJsonPath = join(subdir, "package.json");
          const requirementsPath = join(subdir, "requirements.txt");
          const indexHtmlPath = join(subdir, "index.html");

          let appType = "node";
          if (existsSync(requirementsPath)) {
            appType = "python";
          } else if (existsSync(indexHtmlPath) || existsSync(join(subdir, "public", "index.html"))) {
            appType = "react";
          }

          services.push({
            name: serviceName,
            displayName: serviceName,
            repoSubPath: servicePath,
            appType,
            appPort: appType === "python" ? 8000 : 3000,
            entryPoint: null, // Will use defaults
            buildCommand: null,
            outputDirectory: null,
            envVars: "",
            deploymentType: appType === "static" || appType === "react" ? "s3" : "ec2",
            healthCheckPath: "/health",
            healthCheckPort: null,
            minInstances: 1,
            maxInstances: 3,
            desiredInstances: 1,
          });
        }
      }
    }

    // If no services found in common directories, treat root as single service
    if (services.length === 0) {
      const packageJsonPath = join(repoPath, "package.json");
      const requirementsPath = join(repoPath, "requirements.txt");
      const indexHtmlPath = join(repoPath, "index.html");

      let appType = "node";
      if (existsSync(requirementsPath)) {
        appType = "python";
      } else if (existsSync(indexHtmlPath) || existsSync(join(repoPath, "public", "index.html"))) {
        appType = "static";
      }

      services.push({
        name: "app",
        displayName: "App",
        repoSubPath: "",
        appType,
        appPort: appType === "python" ? 8000 : 3000,
        entryPoint: null,
        buildCommand: null,
        outputDirectory: null,
        envVars: "",
        deploymentType: appType === "static" || appType === "react" ? "s3" : "ec2",
        healthCheckPath: "/health",
        healthCheckPort: null,
        minInstances: 1,
        maxInstances: 3,
        desiredInstances: 1,
      });
    }

    return services;
  } catch (error) {
    console.error("Auto-detection failed:", error);
    // Fallback to single service
    return [{
      name: "app",
      displayName: "App",
      repoSubPath: "",
      appType: "node",
      appPort: 3000,
      entryPoint: null,
      buildCommand: null,
      outputDirectory: null,
      envVars: "",
      deploymentType: "ec2",
      healthCheckPath: "/health",
      healthCheckPort: null,
      minInstances: 1,
      maxInstances: 3,
      desiredInstances: 1,
    }];
  }
}

/**
 * Detect services from repository (tries manifest first, falls back to auto-detection)
 * @param {string} repoUrl - Repository URL
 * @param {string} branch - Branch name
 * @param {Function} log - Logging function
 * @returns {Promise<Array<ServiceConfig>>} - Array of service configurations
 */
export async function detectServices(repoUrl, branch = "main", log) {
  // Clone repository temporarily
  const tmpRepoPath = join(tmpdir(), `deployease-detect-${Date.now()}`);
  
  try {
    await log(`🔍 Detecting services in repository...`);
    
    // Clone repo (shallow clone for speed)
    execSync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tmpRepoPath}`, {
      stdio: "inherit",
      timeout: 60000, // 60 second timeout
    });

    // Try manifest first
    const manifestServices = parseManifest(tmpRepoPath);
    if (manifestServices && manifestServices.length > 0) {
      await log(`✅ Found ${manifestServices.length} service(s) in manifest file`);
      return manifestServices;
    }

    // Fall back to auto-detection
    await log(`📁 No manifest found, attempting auto-detection...`);
    const autoDetected = autoDetectServices(tmpRepoPath);
    await log(`✅ Auto-detected ${autoDetected.length} service(s)`);
    return autoDetected;

  } catch (error) {
    await log(`⚠️ Service detection failed: ${error.message}, falling back to single service`);
    // Ultimate fallback: single service
    return [{
      name: "app",
      displayName: "App",
      repoSubPath: "",
      appType: "node",
      appPort: 3000,
      entryPoint: null,
      buildCommand: null,
      outputDirectory: null,
      envVars: "",
      deploymentType: "ec2",
      healthCheckPath: "/health",
      healthCheckPort: null,
      minInstances: 1,
      maxInstances: 3,
      desiredInstances: 1,
    }];
  } finally {
    // Cleanup
    try {
      execSync(`rm -rf ${tmpRepoPath}`, { stdio: "ignore" });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Normalize service configuration (fill in defaults)
 * @param {ServiceConfig} config - Service configuration
 * @returns {ServiceConfig} - Normalized configuration
 */
export function normalizeServiceConfig(config) {
  return {
    name: config.name || "app",
    displayName: config.displayName || config.name || "App",
    repoSubPath: config.repoSubPath || "",
    appType: config.appType || "node",
    appPort: config.appPort || (config.appType === "python" ? 8000 : 3000),
    entryPoint: config.entryPoint,
    buildCommand: config.buildCommand,
    outputDirectory: config.outputDirectory,
    envVars: config.envVars || "",
    deploymentType: config.deploymentType || (config.appType === "static" || config.appType === "react" ? "s3" : "ec2"),
    healthCheckPath: config.healthCheckPath || "/health",
    healthCheckPort: config.healthCheckPort || config.appPort,
    minInstances: config.minInstances ?? 1,
    maxInstances: config.maxInstances ?? 3,
    desiredInstances: config.desiredInstances ?? 1,
  };
}
