import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

// Lấy key từ môi trường
const RAW_KEY = process.env.ENCRYPTION_KEY || "default_secret_key_too_short_123";

// ĐẢM BẢO KEY LUÔN ĐỦ 32 BYTES
// Cách này sẽ hash key của bạn thành 32 bytes bất kể độ dài đầu vào là bao nhiêu
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(String(RAW_KEY))
  .digest(); 

export const encrypt = (text) => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    // Sử dụng ENCRYPTION_KEY đã được chuẩn hóa (Buffer 32 bytes)
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (error) {
    console.error("Lỗi mã hóa:", error.message);
    return `ERR_ENCRYPT:${text}`; // Thêm tiền tố để bạn nhận diện nếu lỗi
  }
};

export const decrypt = (text) => {
  if (!text || !text.includes(":")) return text;
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption error:", error.message);
    return "[Lỗi giải mã]";
  }
};