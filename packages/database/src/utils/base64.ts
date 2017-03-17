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

  let d = [];

  for (let i = 0; i < a.length; i += 3) {
    let f = a[i];
    let g = i + 1 < a.length;
    let h = g ? a[i + 1] : 0;
    let k = i + 2 < a.length;
    let l = k ? a[i + 2] : 0;
    let m = f >> 2;

    f = (f & 3) << 4 | h >> 4;
    h = (h & 15) << 2 | l >> 6;
    l = l & 63;


    if (!k) {
      l = 64;
      if (!g) {
        h = 64;
      }
    }

    d.push(byteToCharMap[m], byteToCharMap[f], byteToCharMap[h], byteToCharMap[l]);
  }

  return d.join('');
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
