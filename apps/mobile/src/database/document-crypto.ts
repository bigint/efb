import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

export const sha256Bytes = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const result = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes));
  return [...result].map((value) => value.toString(16).padStart(2, '0')).join('');
};
