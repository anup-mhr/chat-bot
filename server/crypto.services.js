const crypto = require("crypto");
const SECRECT_KEY =
  process.env.SECRECT_KEY ||
  "3YhRo89pwA1h+5acNdXcyytNCvQOCMJZQwDSPEvJcksh1cc2cEVHzel6OJRUzRSN";
const SECRECT_IV =
  process.env.SECRECT_IV ||
  "HcvnPh0sK63u943b5IasPO3JvKgC7MqEoeMOuvWzU7Y6IJTfg3rOVkUviM1TMWkc";
const ALGORITHM = process.env.ALGORITHM || "aes-256-cbcconst";
const CryptoJS = require("crypto-js");

const key = crypto
  .createHash("sha512")
  .update(SECRECT_KEY)
  .digest("hex")
  .substring(0, 32);
const encryptionIV = crypto
  .createHash("sha512")
  .update(SECRECT_IV)
  .digest("hex")
  .substring(0, 16);

// Encrypt data
exports.encryptData = function (data, isString = true) {
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, key, encryptionIV);
    isString && (data = JSON.stringify(data));
    return cipher.update(data, "utf8", "hex") + cipher.final("hex");
  } catch (error) {
    console.log("Error from crypto Encryption method: ", error);
    return null;
  }
};

exports.decryptData = function (encryptedData, isJson = true) {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, encryptionIV);

    let deprecatedString =
      decipher.update(encryptedData, "hex", "utf8") + decipher.final("utf8");
    isJson && (deprecatedString = JSON.parse(deprecatedString));
    return deprecatedString;
  } catch (error) {
    console.log("Error from crypto Decryption method: ", error);
    return null;
  }
};

exports.encrypt = (raw) => {
  const secretKey = process.env.SECRET_ENCRYPTION_KEY;
  const encrypted = CryptoJS.AES.encrypt(raw, secretKey).toString();
  return encrypted;
};
