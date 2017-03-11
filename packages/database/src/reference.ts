import { DatabaseInternal } from './database-internal';
import { Query } from './query';
import { Path } from './path';
import { OnDisconnect } from "./on-disconnect";

/**
 * The characters used to generate the push IDs.
 * See: https://gist.github.com/mikelehen/3596a30bd69384624c11
 */
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

export class Reference extends Query {
  private _pushLastTime = 0;
  private _pushLastRandChars: number[] = [];
  private _onDisconnect: OnDisconnect;

  constructor(path: string | Path = '/', db: DatabaseInternal) {
    super(path, db);
  }

  /**
   * The last part of the `Reference`'s path.
   *
   * The key of a root `Reference` is null.
   *
   * @returns {string|null}
   */
  get key(): string | null {
    return this.path.key;
  }

  get root() {
    if (!this.path.length)
      return this;

    return new Reference('/', this.db);
  }

  /**
   * The parent location of a `Reference`.
   *
   * The parent of a root `Reference` is `null`.
   *
   * @returns {Reference}
   */
  get parent(): Reference | null {
    const parentPath = this.path.parent;
    return parentPath ? new Reference(parentPath, this.db) : null;
  }

  child(path: string): Reference {
    return new Reference(this.path.child(path), this.db);
  }

  onDisconnect(): OnDisconnect {
    return this._onDisconnect || (this._onDisconnect = new OnDisconnect(this, this.db));
  }

  push(value?: any): Reference {
    const newRef = this.child(this.generatePushId());

    // TODO: trigger locally if there are any listeners for this path

    if (typeof value !== 'undefined') {
      // TODO: implement an equivalent to ThenableReference to be able to return this Promise
      newRef.set(value);
    }

    return newRef;
  }

  set(value: any): Promise<void> {
    // TODO: trigger locally if there are any listeners for this path
    // TODO: if `value` is an object, check its keys for invalid paths

    return this.db
      .sendDataMessage('p', this, {
        p: this.path.toString(),
        d: value
      })
      .then(() => void 0);
  }

  update(values: { [k: string]: any }): Promise<void> {
    // TODO: trigger locally if there are any listeners for this path, or the nested ones in `values`
    // TODO: check the `values` keys for invalid paths

    return this.db
      .sendDataMessage('m', this, {
        p: this.path.toString(),
        d: values
      })
      .then(() => void 0);
  }

  remove(): Promise<any> {
    return this.set(null);
  }

  setPriority(priority: string | number | null): Promise<void> {
    const newRef = new Reference(this.path.child('.priority', true), this.db);
    return newRef.set(priority);
  }

  setWithPriority(value: any, priority: string | number | null): Promise<void> {
    // TODO: trigger locally if there are any listeners for this path
    // TODO: if `value` is an object, check its keys for invalid paths

    return this.set({
      '.value': value,
      '.priority': priority,
    });
  }

  /**
   * Based on the code provided by Michael Lehenbauer: https://gist.github.com/mikelehen/3596a30bd69384624c11
   * Also see: https://firebase.googleblog.com/2015/02/the-2120-ways-to-ensure-unique_68.html
   *
   * @returns {string}
   */
  private generatePushId(): string {
    let now = Date.now() - this.db.timeDiff;
    const isDuplicateTime = (now === this._pushLastTime);

    this._pushLastTime = now;

    const timeStampChars = new Array(8);

    for (let i = 7; i >= 0; i--) {
      timeStampChars[i] = PUSH_CHARS.charAt(now % 64);

      // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
      now = Math.floor(now / 64);
    }

    if (now !== 0)
      throw new Error('generatePushId: We should have converted the entire timestamp.');

    let id = timeStampChars.join('');

    if (!isDuplicateTime) {
      for (let i = 0; i < 12; i++) {
        this._pushLastRandChars[i] = Math.floor(Math.random() * 64);
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
      let i;
      for (i = 11; (i >= 0) && (this._pushLastRandChars[i] === 63); i--) {
        this._pushLastRandChars[i] = 0;
      }

      this._pushLastRandChars[i]++;
    }

    for (let i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(this._pushLastRandChars[i]);
    }

    if (id.length != 20)
      throw new Error('generatePushId: Length should be 20.');

    return id;
  }

}
