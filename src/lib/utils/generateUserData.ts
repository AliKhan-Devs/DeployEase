import { Deployment } from "@prisma/client";

export function generateUserDataScript(deployments: Deployment[]): string {
  let script = `#!/bin/bash
sudo apt update -y
sudo apt install -y git curl build-essential python3-pip nodejs npm nginx
sudo systemctl enable nginx
`;

  for (const dep of deployments) {
    const slug = dep.slug || dep.repoName;
    const repoDir = `/home/ubuntu/${slug}`;
    const appPort = dep.appPort || (dep.appType === "python" ? 8000 : 3000);
    const branch = dep.branch || "main";

    script += `
# -------- ${slug} (${dep.appType}) --------
git clone -b ${branch} ${dep.repoUrl} ${repoDir} || (cd ${repoDir} && git pull)
`;

    if (dep.envVars) {
      script += `echo '${dep.envVars}' > ${repoDir}/.env\n`;
    }

    if (dep.appType === "node") {
      const entry = dep.entryPoint || "index.js";
      script += `
cd ${repoDir}
if [ -f package-lock.json ]; then npm ci; else npm install; fi
PORT=${appPort} pm2 start ${entry} --name ${slug} --update-env || pm2 restart ${slug}
pm2 save
`;
    } else if (dep.appType === "react") {
      script += `
cd ${repoDir}
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build
sudo mkdir -p /var/www/${slug}
sudo rm -rf /var/www/${slug}/*
sudo cp -r build/* /var/www/${slug}/
sudo chown -R www-data:www-data /var/www/${slug}
`;
    } else if (dep.appType === "python") {
      const entry = dep.entryPoint || "app.py";
      script += `
cd ${repoDir}
if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi
PORT=${appPort} pm2 start ${entry} --name ${slug} --interpreter python3 --update-env || pm2 restart ${slug}
pm2 save
`;
    } else if (dep.appType === "static") {
      script += `
sudo mkdir -p /var/www/${slug}
sudo rm -rf /var/www/${slug}/*
sudo cp -r ${repoDir}/* /var/www/${slug}/
sudo chown -R www-data:www-data /var/www/${slug}
`;
    }
  }

  return script;
}
