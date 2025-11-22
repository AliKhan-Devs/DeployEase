// --------------------------
// Ensure base Nginx setup
// --------------------------



const NGINX_APPS_DIR = "/etc/nginx/apps"; // dedicated directory for apps
const NGINX_SITE_LINK = "/etc/nginx/sites-enabled"; // symlinks here

export async function ensureNginxBase(ssh) {
    const baseConfig = `
  server {
      listen 80 default_server;
      listen [::]:80 default_server;
  
      server_name _;
  
      client_max_body_size 50M;
  
      location = / {
          return 200 'DeployEase server running';
      }
  }
  `.trim();
  
    // Create necessary directories
    await ssh.execCommand(`sudo mkdir -p ${NGINX_APPS_DIR}`);
    await ssh.execCommand(`sudo mkdir -p ${NGINX_SITE_LINK}`);
  
    // Remove only conflicting default files/symlinks
    await ssh.execCommand(`sudo rm -f /etc/nginx/sites-enabled/default`);
    await ssh.execCommand(`sudo rm -f /etc/nginx/sites-enabled/default.conf`);
    await ssh.execCommand(`sudo rm -f /etc/nginx/sites-enabled/deployease`);
    await ssh.execCommand(`sudo rm -f /etc/nginx/sites-available/default`);
  
    // Write base config to apps directory
    const baseConfPath = `${NGINX_APPS_DIR}/default.conf`;
    await ssh.execCommand(
      `echo "${baseConfig.replace(/"/g, '\\"')}" | sudo tee ${baseConfPath}`
    );
  
    // Symlink to sites-enabled
    await ssh.execCommand(`sudo ln -sf ${baseConfPath} ${NGINX_SITE_LINK}/default.conf`);
  
    // Test & reload
    await ssh.execCommand(`sudo nginx -t`);
    await ssh.execCommand(`sudo systemctl restart nginx`);
  }
  
  // --------------------------
  // Write per-app Nginx config
  // --------------------------
  export async function writeNginxLocation({ ssh, slug, appType, appPort, staticRoot }) {
    const webRoot = staticRoot || `/var/www/${slug}`;
  
    let locationBlock = "";
  
    if (appType === "node" || appType === "python") {
      locationBlock = `
      location /${slug}/ {
          rewrite ^/${slug}/(.*)$ /$1 break;
  
          proxy_pass http://127.0.0.1:${appPort}/;
          proxy_set_header Host \\$host;
          proxy_set_header X-Real-IP \\$remote_addr;
          proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
          proxy_http_version 1.1;
          proxy_set_header Upgrade \\$http_upgrade;
          proxy_set_header Connection "upgrade";
      }
  
      location = /${slug} {
          return 302 /${slug}/;
      }
      `;
    } else {
      locationBlock = `
      location /${slug}/ {
          alias ${webRoot}/;
          index index.html;
          try_files \\$uri \\$uri/ /index.html;
      }
  
      location /static/ {
          alias ${webRoot}/static/;
      }
  
      location /assets/ {
          alias ${webRoot}/assets/;
      }
  
      location /favicon.ico {
          alias ${webRoot}/favicon.ico;
      }
  
      location /manifest.json {
          alias ${webRoot}/manifest.json;
      }
  
      location = /${slug} {
          return 302 /${slug}/;
      }
  
      `;
    }
  
    // Shared config file
    const SHARED_CONF = "/etc/nginx/apps/deployease.conf";
  
    // Ensure base file exists
    await ssh.execCommand(`
      sudo bash -c '
      if [ ! -f "${SHARED_CONF}" ]; then
        echo "server {
            listen 80;
            server_name _;
            client_max_body_size 50M;
        }" > "${SHARED_CONF}"
      fi
      '
    `);
  
    // Insert location block inside the shared server block
   // 1️⃣ Read current config
const { stdout: currentConf } = await ssh.execCommand(`sudo cat ${SHARED_CONF}`);

// 2️⃣ Check if this slug is already there
if (!currentConf.includes(`/${slug}/`)) {
  // 3️⃣ Append location block before final closing brace
  const newConf = currentConf.replace(/}\s*$/, `\n${locationBlock}\n}`);

  // 4️⃣ Write back updated config
  await ssh.execCommand(`echo "${newConf.replace(/"/g, '\\"')}" | sudo tee ${SHARED_CONF}`);
} else {
  console.log(`Nginx location for ${slug} already exists, skipping append.`);
}

  
    // Symlink to sites-enabled
    await ssh.execCommand(`sudo ln -sf ${SHARED_CONF} /etc/nginx/sites-enabled/deployease.conf`);
  
    // Cleanup default nginx files
    await ssh.execCommand(`sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default`);
  // also clean default.conf nginx files
  await ssh.execCommand(`sudo rm -f /etc/nginx/sites-enabled/default.conf /etc/nginx/sites-available/default.conf`);
    // Reload nginx
    await ssh.execCommand(`sudo systemctl start nginx`);
    await ssh.execCommand(`sudo nginx -t`);
    await ssh.execCommand(`sudo systemctl reload nginx`);
  }
  