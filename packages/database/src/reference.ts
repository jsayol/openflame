import { DatabaseInternal } from './database-internal';
import { Query } from './query';
import { Path } from './path';
import { OnDisconnect } from './on-disconnect';
import { NotifierEvent } from './notifier';
import { Transaction, TransactionOptions, TransactionResult } from './transaction';
import { generatePushKey } from './utils/push-key';
import { DataSnapshot } from './data-snapshot';

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

    return new Reference('/', this._db);
  }

  /**
   * The parent location of a `Reference`.
   * The parent of a root `Reference` is `null`.
   *
   * @returns {Reference}
   */
  get parent(): Reference | null {
    const parentPath = this.path.parent;
    return parentPath ? new Reference(parentPath, this._db) : null;
  }

  child(path: string): Reference {
    return new Reference(this.path.child(path), this._db);
  }

  onDisconnect(): OnDisconnect {
    return this._onDisconnect || (this._onDisconnect = new OnDisconnect(this, this._db));
  }

  push(): Reference;
  push(value: any): ThenableReference;
  push(value?: any): Reference | ThenableReference {
    const pushKey = generatePushKey(this._db.timeDiff);

    if (typeof value === 'undefined') {
      return this.child(pushKey);
    }

    const thenableRef = new ThenableReference(this.path.child(pushKey), this._db);
    thenableRef.set(value);

    return thenableRef;
  }

  set(value: any): Promise<void> {
    // TODO: if `value` is an object, check its keys for invalid paths
    // TODO: transform arrays to Firebase array-like objects: ["abc", "def"] to {"0":"abc", "1":"def"}

    // Do an optimistic update
    const optimisticEvents: NotifierEvent[] = [];
    this._db.updateModel(this.path, value, {optimisticEvents});

    return this._db
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
      this._db.updateModel(this.path.child(subpath), values[subpath], {optimisticEvents});
    });

    return this._db
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
    const newRef = new Reference(this.path.child('.priority', true), this._db);
    return newRef.set(priority);
  }

  setWithPriority(value: any, priority: string | number | null): Promise<void> {
    // TODO: if `value` is an object, check its keys for invalid paths

    return this.set({
      '.value': value,
      '.priority': priority,
    });
  }

  /**
   * Transaction
   * @param updateFunc
   * @param onComplete
   * @param options
   * @returns {Promise<TransactionResult>}
   */
  transaction(updateFunc: (value: any) => any,
              onComplete: (err: Error | null, commited: boolean, snap: DataSnapshot) => any,
              options: TransactionOptions = {}): Promise<TransactionResult> {
    const transaction = new Transaction(this, this._db, updateFunc, onComplete, options);
    return transaction.promise;
  }

}

/**
 * NOTE: This class should ideally be on a separate file but it needs to stay here
 * for now due to a bug with Webpack: https://github.com/webpack/webpack/issues/4520
 */
export class ThenableReference extends Reference {
  private _promise: Promise<void>;

  constructor(path: Path, db: DatabaseInternal) {
    super(path, db);
  }

  set(value: any): Promise<void> {
    this._promise = super.set(value);
    return this._promise;
  }

  then(onfulfilled?: (() => any) | undefined | null,
       onrejected?: ((reason: any) => any) | undefined | null): Promise<void> {
    return this._promise.then<void>(onfulfilled, onrejected);
  }

  catch<T>(onrejected?: ((reason: any) => T) | undefined | null): Promise<T> {
    return this._promise.catch<T>(onrejected);
  }
}

export { TransactionOptions, TransactionResult } from './transaction';
