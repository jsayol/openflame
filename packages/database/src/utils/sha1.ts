/**
 * Incrementally computes the SHA-1 hash for a given string or byte array
 */
export class Sha1 {
  private _blockSize = 64;
  private _chain = [];
  private _buf = [];
  private _W = [];
  private _pad = [128];
  private _total = 0;
  private _inbuf = 0;

  constructor() {
    for (let a = 1; a < this._blockSize; ++a) {
      this._pad[a] = 0;
    }

    this.reset();
  }

  reset() {
    this._total = 0;
    this._inbuf = 0;
    this._chain[0] = 1732584193;
    this._chain[1] = 4023233417;
    this._chain[2] = 2562383102;
    this._chain[3] = 271733878;
    this._chain[4] = 3285377520;
  }

  private _compress(data: string | number[], b: number = 0) {
    if (typeof data === 'string') {
      for (let i = 0; i < 16; i++) {
        this._W[i] = data.charCodeAt(b) << 24 | data.charCodeAt(b + 1) << 16 | data.charCodeAt(b + 2) << 8 | data.charCodeAt(b + 3);
        b += 4;
      }
    } else {
      for (let i = 0; i < 16; i++) {
        this._W[i] = data[b] << 24 | data[b + 1] << 16 | data[b + 2] << 8 | data[b + 3];
        b += 4;
      }
    }

    for (let i = 16; i < 80; i++) {
      let e = this._W[i - 3] ^ this._W[i - 8] ^ this._W[i - 14] ^ this._W[i - 16];
      this._W[i] = (e << 1 | e >>> 31) & 4294967295;
    }

    let chain0 = this._chain[0];
    let chain1 = this._chain[1];
    let chain2 = this._chain[2];
    let chain3 = this._chain[3];
    let chain4 = this._chain[4];

    for (let i = 0; i < 80; i++) {
      let t, m;

      if (i < 40) {
        if (i < 20) {
          t = chain3 ^ chain1 & (chain2 ^ chain3);
          m = 1518500249;
        } else {
          t = chain1 ^ chain2 ^ chain3;
          m = 1859775393;
        }
      } else {
        if (i < 60) {
          t = chain1 & chain2 | chain3 & (chain1 | chain2);
          m = 2400959708;
        } else {
          t = chain1 ^ chain2 ^ chain3;
          m = 3395469782;
        }
      }

      t = (chain0 << 5 | chain0 >>> 27) + t + chain4 + m + this._W[i] & 4294967295;
      chain4 = chain3;
      chain3 = chain2;
      chain2 = (chain1 << 30 | chain1 >>> 2) & 4294967295;
      chain1 = chain0;
      chain0 = t;
    }

    this._chain[0] = this._chain[0] + chain0 & 4294967295;
    this._chain[1] = this._chain[1] + chain1 & 4294967295;
    this._chain[2] = this._chain[2] + chain2 & 4294967295;
    this._chain[3] = this._chain[3] + chain3 & 4294967295;
    this._chain[4] = this._chain[4] + chain4 & 4294967295;
  };

  update(data: string | number[], b = data.length) {
    let c = b - this._blockSize;
    let _buf = this._buf;
    let _inbuf = this._inbuf;
    let i = 0;

    while (i < b) {
      if (0 == _inbuf) {
        while (i <= c) {
          this._compress(data, i);
          i += this._blockSize;
        }
      }

      if (typeof data === 'string') {
        while (i < b) {
          _buf[_inbuf] = data.charCodeAt(i);
          _inbuf += 1;
          i += 1;

          if (_inbuf == this._blockSize) {
            this._compress(_buf);
            _inbuf = 0;
            break;
          }
        }
      } else {
        while (i < b) {
          _buf[_inbuf++] = data[i++];

          if (_inbuf == this._blockSize) {
            this._compress(_buf);
            _inbuf = 0;
            break;
          }
        }
      }
    }

    this._inbuf = _inbuf;
    this._total += b;
  }

  digest() {
    const result = [];
    let b = 8 * this._total;

    if (56 > this._inbuf) {
      this.update(this._pad, 56 - this._inbuf);
    } else {
      this.update(this._pad, this._blockSize - (this._inbuf - 56));
    }

    for (let c = this._blockSize - 1; 56 <= c; c--) {
      this._buf[c] = b & 255;
      b /= 256;
    }

    this._compress(this._buf);

    let pos = 0;
    for (let i = 0; 5 > i; i++) {
      for (let j = 24; 0 <= j; j -= 8) {
        result[pos++] = this._chain[i] >> j & 255;
      }
    }

    return result;
  }

}
