import { DatabaseInternal } from './database-internal';
import { Query } from './query';
import { Path } from './path';
import { OnDisconnect } from "./on-disconnect";
import { NotifierEvent } from "./notifier";
import { generatePushKey } from './utils/push-key';

export class Reference extends Query {
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
    const newRef = this.child(generatePushKey(this.db.timeDiff));

    if (typeof value !== 'undefined') {
      // TODO: implement an equivalent to ThenableReference to be able to return this Promise
      newRef.set(value);
    }

    return newRef;
  }

  set(value: any): Promise<void> {
    // TODO: if `value` is an object, check its keys for invalid paths
    // TODO: transform arrays to Firebase array-like objects: ["abc", "def"] to {"0":"abc", "1":"def"}

    // Do an optimistic update
    const optimisticEvents: NotifierEvent[] = [];
    this.db.updateModel(this.path, value, {optimisticEvents});

    return this.db
      .sendDataMessage('p', this, {
        p: this.path.toString(),
        d: value
      }, optimisticEvents)
      .then(() => void 0);
  }

  update(values: { [k: string]: any }): Promise<void> {
    // TODO: check the `values` keys for invalid paths

    // Do an optimistic update
    const optimisticEvents: NotifierEvent[] = [];
    Object.getOwnPropertyNames(values).forEach((subpath: string) => {
      this.db.updateModel(this.path.child(subpath), values[subpath], {optimisticEvents});
    });

    return this.db
      .sendDataMessage('m', this, {
        p: this.path.toString(),
        d: values
      }, optimisticEvents)
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
    // TODO: if `value` is an object, check its keys for invalid paths

    return this.set({
      '.value': value,
      '.priority': priority,
    });
  }

}
