import CryptoJS from "crypto-js";

const SECRET = process.env.FIREBASE_ENCRYPTION_SECRET || process.env.NEXT_PUBLIC_FIREBASE_ENCRYPTION_SECRET || "default-secret-key";

export function encryptText(text: string) {
  if (!text) return "";
  try {
    if (!SECRET || SECRET === "default-secret-key") {
      console.warn("Encryption secret not configured, using plain text");
      return text;
    }
    return CryptoJS.AES.encrypt(text, SECRET).toString();
  } catch (error) {
    console.error("Encryption error:", error);
    return text; // Return plain text if encryption fails
  }
}

export function decryptText(cipher: string) {
  if (!cipher) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error("Decryption error:", e);
    return "";
  }
}
