import { DataSnapshot } from './data-snapshot';
import { Reference } from './reference';
import { DataModel } from './data-model';
import { DatabaseInternal } from './database-internal';
import { Subscription } from 'rxjs';
import { async as asyncScheduler } from 'rxjs/scheduler/async';
import 'rxjs/add/operator/observeOn';

/**
 * @internal
 */
export class Transaction {
  private _promise: Promise<TransactionResult>;
  private _resolve: (value?: TransactionOptions) => void;
  private _reject: (reason?: any) => void;
  private _applyLocally: boolean;
  private _maxTries: number;
  private _numTries = 0;
  private _knownValue: any;
  private _lastTriedValue: any;
  private _waitingForValue = false;
  private _subscription: Subscription;

  constructor(private _ref: Reference,
              private _db: DatabaseInternal,
              private _updateFunc: (value: any) => any,
              private _onComplete: (err: Error | null, commited: boolean, snap: DataSnapshot) => any,
              {applyLocally = true, maxTries = Infinity}: TransactionOptions) {

    this._applyLocally = applyLocally;
    this._maxTries = maxTries;

    this._promise = new Promise((resolve: (value?: any) => void, reject: (reason?: any) => void) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    this._subscription = this._ref.value$.observeOn(asyncScheduler).subscribe(
      (snap: DataSnapshot) => {
        const value = snap.val();

        // If _applyLocally is true, here we will also recieve notifications for the values we just tried ourselves.
        // In that case, only update the known value if it's different from the one we just tried.
        if (!this._applyLocally || (DataModel.getHash(this._lastTriedValue) !== DataModel.getHash(value))) {
          this._knownValue = value;

          if (this._waitingForValue) {
            this._waitingForValue = false;
            this.go();
          }
        }
      },

      // Handle if the observable ends with an error
      (error: any) => this.error(error),

      // Handle if the observable completes before the transaction has been committed
      () => this.finished(false),
    );

    try {
      this._knownValue = this._db.model.child(this._ref.path).toObject();
      this.go();
    } catch (error) {
      if (!this._subscription.closed) {
        this._subscription.unsubscribe();
      }
      this.error(error);
      throw error;
    }
  }

  get promise(): Promise<TransactionResult> {
    return this._promise;
  }

  private go() {
    if (this._numTries >= this._maxTries) {
      // We've reached the maximum number of tries that were requested
      this.finished(false);
      return;
    }

    const previousValue = this._knownValue;
    const newValue = this._updateFunc(previousValue);

    // TODO: if `newValue` is an object, check its keys for invalid paths

    if (typeof newValue === 'undefined') {
      this.finished(false);
      return;
    }

    this.set(previousValue, newValue)
      .then((committedValue: any) => {
        this._knownValue = committedValue;
        this.finished(true);
      })
      .catch((error: Error) => {
        const errorCode = error.message.split(' ').shift();

        if (errorCode === 'datastale') {
          // Transaction failed because we had stale data

          if (this._knownValue === previousValue) {
            // Value hasn't changed, let's wait
            this._waitingForValue = true;
          } else {
            // Let's retry
            this.go();
          }
        } else {
          // Oops, something went wrong. End the transaction with an error
          this.error(error);
        }
      });
  }

  private snapshot(): DataSnapshot {
    return new DataSnapshot(this._ref, new DataModel(this._ref.key, null, this._knownValue));
  }

  private finished(committed: boolean) {
    if (!this._subscription.closed) {
      this._subscription.unsubscribe();
    }

    // If we applied any updates locally but the transaction wasn't committed, let's
    // do one final local update with the known (hopefully correct) value
    if (!committed && this._applyLocally && this._numTries) {
      this._db.updateModel(this._ref.path, this._knownValue);
    }

    const snapshot = this.snapshot();

    if (this._onComplete) {
      this._onComplete(null, committed, snapshot);
    }

    this._resolve(<TransactionResult>{committed, snapshot});
  }

  private error(error: Error) {
    if (!this._subscription.closed) {
      this._subscription.unsubscribe();
    }

    // If we applied any updates locally, let's do one final local update with
    // the known (hopefully correct) value
    if (this._applyLocally && this._numTries) {
      this._db.updateModel(this._ref.path, this._knownValue);
    }

    if (this._onComplete) {
      this._onComplete(error, false, this.snapshot());
    }

    this._reject(error);
  }

  private set(previousValue: any, newValue: any): Promise<any> {
    this._numTries += 1;
    this._lastTriedValue = newValue;

    if (this._applyLocally) {
      this._db.updateModel(this._ref.path, newValue);
    }

    return this._db
      .sendDataMessage('p', this._ref, {
        p: this._ref.path.toString(),
        d: newValue,
        h: DataModel.getHash(previousValue)
      });
  }

}

export interface TransactionResult {
  committed: boolean;
  snapshot: DataSnapshot;
}

export interface TransactionOptions {
  applyLocally?: boolean;
  maxTries?: number;
}
