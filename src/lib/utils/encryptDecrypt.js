


const ENCRYPTION_KEY = (process.env.DEPLOY_EASE_SECRET_KEY || "").padEnd(32, "0").slice(0, 32);
const ENCRYPTION_IV = (process.env.DEPLOY_EASE_SECRET_IV || "").padEnd(16, "0").slice(0, 16);



export function encryptSecret(value) {
    if (!value) return null;
    if (!process.env.DEPLOY_EASE_SECRET_KEY || !process.env.DEPLOY_EASE_SECRET_IV) return value;
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), Buffer.from(ENCRYPTION_IV));
    let encrypted = cipher.update(value, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }
  
  export function decryptSecret(value) {
    if (!value) return null;
    if (!process.env.DEPLOY_EASE_SECRET_KEY || !process.env.DEPLOY_EASE_SECRET_IV) return value;
    try {
      const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), Buffer.from(ENCRYPTION_IV));
      let decrypted = decipher.update(value, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (err) {
      console.warn("Failed to decrypt secret; falling back to stored value.");
      return value;
    }
  }