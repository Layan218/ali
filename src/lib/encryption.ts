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
  
  // Check if text looks encrypted (CryptoJS encrypted strings start with "U2FsdGVk")
  const looksEncrypted = cipher.startsWith("U2FsdGVk");
  
  // If it doesn't look encrypted, return as-is (it's plain text)
  if (!looksEncrypted) {
    return cipher;
  }
  
  // If secret is not configured, can't decrypt - return original
  if (!SECRET || SECRET === "default-secret-key") {
    return cipher;
  }
  
  // Try to decrypt
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // Check if decryption was successful
    // If decrypted result is empty or still looks encrypted, decryption failed
    if (!decrypted || decrypted.length === 0 || decrypted.startsWith("U2FsdGVk")) {
      // Decryption failed - return original
      return cipher;
    }
    
    // Validate that the decrypted text is reasonable
    // Check if it contains valid printable characters
    const hasValidChars = /[\u0020-\u007E\u00A0-\uFFFF]/.test(decrypted);
    
    // For very short text, be more lenient with length check
    const minLength = cipher.length < 50 ? 1 : Math.max(1, cipher.length * 0.1);
    const reasonableLength = decrypted.length >= minLength;
    
    if (!hasValidChars || !reasonableLength) {
      // Decrypted text doesn't look valid, return original
      return cipher;
    }
    
    return decrypted;
  } catch (e) {
    // If decryption fails with an exception, return original
    return cipher;
  }
}
