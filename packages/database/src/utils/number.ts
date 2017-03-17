/**
 * Converts a number to its hexadecimal IEEE-754 representation
 * @param value
 * @returns {string}
 */
export function toIEEE754Hex(value: number) {
  if (typeof value !== 'number') {
    throw new Error('toIEEE754Hex: value is not a number')
  }

  let isNegative: boolean;
  let exponent: number;
  let mantissa: number;

  if (value === 0) {
    mantissa = 0;
    exponent = 0;
    isNegative = 1 / value === -Infinity;
  } else {
    isNegative = value < 0;
    value = Math.abs(value);

    if (value >= Math.pow(2, -1022)) {
      mantissa = Math.min(Math.floor(Math.log(value) / Math.LN2), 1023);
      exponent = mantissa + 1023;
      mantissa = Math.round(value * Math.pow(2, 52 - mantissa) - Math.pow(2, 52));
    } else {
      exponent = 0;
      mantissa = Math.round(value / Math.pow(2, -1074));
    }
  }

  let bits: Array<0 | 1> = [];

  for (let i = 52; i > 0; --i) {
    bits.push(mantissa % 2 ? 1 : 0);
    mantissa = Math.floor(mantissa / 2);
  }

  for (let i = 11; i > 0; --i) {
    bits.push(exponent % 2 ? 1 : 0);
    exponent = Math.floor(exponent / 2);
  }

  bits.push(isNegative ? 1 : 0);
  bits.reverse();

  let binString = bits.join('');
  let hexString = '';

  for (let i = 0; i < 64; i += 8) {
    let hexByteStr = parseInt(binString.substr(i, 8), 2).toString(16);

    if (hexByteStr.length === 1) {
      hexByteStr = '0' + hexByteStr;
    }

    hexString += hexByteStr;
  }

  return hexString.toLowerCase();
}


