import { DataSnapshot } from './data-snapshot';
import { Reference } from './reference';
import { DataModel } from './data-model';
import { NotifierEvent } from './notifier';
import { DatabaseInternal } from './database-internal';
import { Subscription } from 'rxjs';
import { async as asyncScheduler } from 'rxjs/scheduler/async';
import 'rxjs/add/operator/observeOn';

export class Transaction {
  private _promise: Promise<TransactionResult>;
  private _resolve: Function;
  private _reject: Function;
  private _value: any;
  private _waitingValue = false;
  private _subscription: Subscription;

  constructor(private _ref: Reference,
              private _db: DatabaseInternal,
              private _updateFunc: (value: any) => any,
              private _onComplete: (err: Error | null, commited: boolean, snap: DataSnapshot) => any,
              private _applyLocally = true) {

    this._promise = new Promise((resolve: Function, reject: Function) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    this._subscription = this._ref.value$.observeOn(asyncScheduler).subscribe((snap: DataSnapshot) => {
      // Ignore any optimistic update, since it *probably* was triggered by the transaction itself
      // FIXME: what happens if this optimistic update came from elsewhere? The transaction might end up in limbo
      if (!snap.optimistic) {
        this._value = snap.val();

        if (this._waitingValue) {
          this._waitingValue = false;
          this.go();
        }
      }
    });

    try {
      this._value = this._db.model.child(this._ref.path).toObject();
      this.go();
    } catch (err) {
      this._subscription.unsubscribe();
      throw err;
    }
  }

  get promise(): Promise<TransactionResult> {
    return this._promise;
  }

  private go() {
    const previousValue = this._value;
    const newValue = this._updateFunc(previousValue);

    // TODO: if `newValue` is an object, check its keys for invalid paths

    if (typeof newValue === 'undefined') {
      this.finished(false);
      return;
    }

    this.set(previousValue, newValue)
      .then((commitedValue: any) => {
        this._value = commitedValue;
        this.finished(true);
      })
      .catch((error: Error) => {
        const errorCode = error.message.split(' ').shift();

        if (errorCode === 'datastale') {
          // Transaction failed

          if (this._value === previousValue) {
            // Value hasn't changed, let's wait
            this._waitingValue = true;
          } else {
            console.log('Retrying', previousValue, this._value);
            // Let's retry
            this.go();
          }
        } else {
          // Oops, something went wrong. Abort the transaction.
          this.error(error);
        }
      });
  }

  private snapshot(): DataSnapshot {
    return new DataSnapshot(this._ref, new DataModel(this._ref.key, null, this._value));
  }

  private finished(commited: boolean) {
    if (!this._subscription.closed) {
      this._subscription.unsubscribe();
    }

    const snapshot = this.snapshot();

    this._resolve({commited, snapshot});

    if (this._onComplete) {
      this._onComplete(null, commited, snapshot);
    }
  }

  private error(error: Error) {
    if (!this._subscription.closed) {
      this._subscription.unsubscribe();
    }

    this._reject(error);

    if (this._onComplete) {
      this._onComplete(error, false, this.snapshot());
    }
  }

  private set(previousValue: any, newValue: any): Promise<any> {
    let optimisticEvents: NotifierEvent[];

    if (this._applyLocally) {
      // Do an optimistic update
      // FIXME: This optimistic updates shouldn't be rolled back unless the transaction ends uncommited
      optimisticEvents = [];
      this._db.updateModel(this._ref.path, newValue, {optimisticEvents});
    }

    return this._db
      .sendDataMessage('p', this._ref, {
        p: this._ref.path.toString(),
        d: newValue,
        h: DataModel.getHash(previousValue)
      }, optimisticEvents);
  }

}

export interface TransactionResult {
  commited: boolean;
  snapshot: DataSnapshot;
}
