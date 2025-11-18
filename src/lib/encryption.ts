import CryptoJS from "crypto-js";

const SECRET = process.env.FIREBASE_ENCRYPTION_SECRET!;

export function encryptText(text: string) {
  if (!text) return "";
  return CryptoJS.AES.encrypt(text, SECRET).toString();
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
