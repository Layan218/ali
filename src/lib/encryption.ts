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
  
  // If secret is not configured, assume plain text
  if (!SECRET || SECRET === "default-secret-key") {
    return cipher;
  }
  
  try {
    // Check if the cipher looks like encrypted data (CryptoJS encrypted strings are base64-like)
    // Encrypted strings typically contain base64 characters and are usually longer
    // However, we'll try to decrypt first and validate the result
    
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // Check if decryption was successful
    // If decrypted result is empty, it probably wasn't encrypted or decryption failed
    if (!decrypted || decrypted.length === 0) {
      // Decryption failed or produced empty result, return original
      return cipher;
    }
    
    // Validate that the decrypted text is valid and meaningful
    // Check if it contains valid printable characters (including Arabic, etc.)
    // If the decrypted text is much shorter than original, it might be invalid
    const hasValidChars = /[\u0020-\u007E\u00A0-\uFFFF]/.test(decrypted);
    const reasonableLength = decrypted.length >= cipher.length * 0.3; // At least 30% of original length
    
    if (!hasValidChars || !reasonableLength) {
      // Decrypted text doesn't look valid, return original
      return cipher;
    }
    
    return decrypted;
  } catch (e) {
    // If decryption fails with an exception, assume it's plain text
    // This handles "Malformed UTF-8 data" and other decryption errors
    return cipher;
  }
}
