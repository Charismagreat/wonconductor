const crypto = require('crypto');

const SALT_SIZE = 16;
const KEY_LEN = 64;

function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return derivedKey.toString('hex') === hash;
}

const storedHash = "32902f47a650e7690e6bee1edef56ec4:eb85c4e15054edb6ea2fe0dfebb18594eb096670f7a9f0e0437d5cd4eb9ab5fd5e7e13bed26e7160368941c0b9b82370577d24e90379bdc73365dbdfb68672fa";

console.log("Checking password '1234'...");
const result = verifyPassword('1234', storedHash);
console.log("Match Result:", result);
