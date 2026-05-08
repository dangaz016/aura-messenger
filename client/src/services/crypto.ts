import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const PRIVATE_KEY_STORAGE = 'aura_private_key';
const PUBLIC_KEY_STORAGE = 'aura_public_key';

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export const cryptoService = {
  generateKeyPair(): KeyPair {
    const kp = nacl.box.keyPair();
    return {
      publicKey: encodeBase64(kp.publicKey),
      secretKey: encodeBase64(kp.secretKey),
    };
  },

  getOrCreateKeyPair(): KeyPair {
    let pub = localStorage.getItem(PUBLIC_KEY_STORAGE);
    let sec = localStorage.getItem(PRIVATE_KEY_STORAGE);
    if (!pub || !sec) {
      const kp = this.generateKeyPair();
      localStorage.setItem(PUBLIC_KEY_STORAGE, kp.publicKey);
      localStorage.setItem(PRIVATE_KEY_STORAGE, kp.secretKey);
      pub = kp.publicKey;
      sec = kp.secretKey;
    }
    return { publicKey: pub, secretKey: sec };
  },

  clearKeys() {
    localStorage.removeItem(PUBLIC_KEY_STORAGE);
    localStorage.removeItem(PRIVATE_KEY_STORAGE);
  },

  encrypt(message: string, recipientPublicKey: string, senderSecretKey: string): string {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint = decodeUTF8(message);
    const encrypted = nacl.box(
      messageUint,
      nonce,
      decodeBase64(recipientPublicKey),
      decodeBase64(senderSecretKey)
    );
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    return encodeBase64(combined);
  },

  decrypt(encryptedMessage: string, senderPublicKey: string, recipientSecretKey: string): string | null {
    try {
      const combined = decodeBase64(encryptedMessage);
      const nonce = combined.slice(0, nacl.box.nonceLength);
      const ciphertext = combined.slice(nacl.box.nonceLength);
      const decrypted = nacl.box.open(
        ciphertext,
        nonce,
        decodeBase64(senderPublicKey),
        decodeBase64(recipientSecretKey)
      );
      if (!decrypted) return null;
      return encodeUTF8(decrypted);
    } catch {
      return null;
    }
  },
};
