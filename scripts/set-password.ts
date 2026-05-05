import { updateRows } from '../egdesk-helpers';
import crypto from 'crypto';

async function main() {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync('1234', salt, 64);
    const hashed = salt + ':' + derivedKey.toString('hex');
    const result = await updateRows('user', { password: hashed }, { filters: { username: 'gyeong_jiwon' } });
    console.log('✅ Password set:', result);
}

main().catch(console.error);
