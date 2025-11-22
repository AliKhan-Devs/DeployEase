async function configureStaticApp({ ssh, repoDir, slug, log, appDir }) {
    await log("📦 Publishing static assets...");
    const sourceDir = appDir || repoDir;
    await ssh.execCommand(
      `bash -lc 'set -e; sudo mkdir -p /var/www/${slug}; sudo rm -rf /var/www/${slug}/*; sudo cp -r "${sourceDir}/"* /var/www/${slug}/; sudo chown -R www-data:www-data /var/www/${slug}'`
    );
  }
  