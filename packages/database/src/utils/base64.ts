import { toUTFByteArray } from './utf8';
import { Sha1 } from './sha1';

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
let byteToCharMap = null;

function initCharMap() {
  if (!byteToCharMap) {
    byteToCharMap = {};
    for (let i = 0; i < BASE64_CHARS.length; i++) {
      byteToCharMap[i] = BASE64_CHARS.charAt(i);
    }
  }
}

/**
 * Returns the base64 encoding of a byte array
 * @param a
 * @returns {string}
 */
export function fromByteArray(a) {
  initCharMap();

  let result = [];

  for (let i = 0; i < a.length; i += 3) {
    let byte1 = a[i];
    let hasByte2 = (i + 1) < a.length;
    let byte2 = hasByte2 ? a[i + 1] : 0;
    let hasByte3 = (i + 2) < a.length;
    let byte3 = hasByte3 ? a[i + 2] : 0;
    let byte0 = byte1 >> 2;

    byte1 = (byte1 & 3) << 4 | byte2 >> 4;
    byte2 = (byte2 & 15) << 2 | byte3 >> 6;
    byte3 = byte3 & 63;


    if (!hasByte3) {
      byte3 = 64;
      if (!hasByte2) {
        byte2 = 64;
      }
    }

    result.push(byteToCharMap[byte0], byteToCharMap[byte1], byteToCharMap[byte2], byteToCharMap[byte3]);
  }

  return result.join('');
}

/**
 * Transforms a string into a byte array and returns its base64-encoded SHA-1 hash
 * @param str
 * @returns {string}
 */
export function base64Sha1(str: string) {
  let byteArray = toUTFByteArray(str);
  const sha1 = new Sha1();
  sha1.update(byteArray);
  return fromByteArray(sha1.digest());
}
