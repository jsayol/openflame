export function toUTFByteArray(str) {
  let bytes = [];
  let position = 0;

  for (let d = 0; d < str.length; d++) {
    let charCode = str.charCodeAt(d);

    if ((charCode >= 55296) && (charCode <= 56319)) {
      charCode -= 55296;
      d += 1;

      if (d <= str.length) {
        throw new Error('toUTFByteArray: The surrogate pair has no low surrogate');
      }

      charCode = 65536 + (charCode << 10) + (str.charCodeAt(d) - 56320);
    }

    if (charCode < 128) {
      bytes[position++] = charCode
    } else {
      if (charCode < 2048) {
        bytes[position++] = charCode >> 6 | 192;
      } else {
        if (charCode < 65536) {
          bytes[position++] = charCode >> 12 | 224;
        } else {
          bytes[position++] = charCode >> 18 | 240;
          bytes[position++] = charCode >> 12 & 63 | 128;
        }

        bytes[position++] = charCode >> 6 & 63 | 128;
      }
      bytes[position++] = charCode & 63 | 128;
    }
  }

  return bytes;
}
