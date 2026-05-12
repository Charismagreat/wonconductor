const crypto = require('crypto');

const SALT_SIZE = 16;
const KEY_LEN = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_SIZE).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return `${salt}:${derivedKey.toString('hex')}`;
}

const password = 'admin123!';
const hashedPassword = hashPassword(password);
console.log(hashedPassword);
