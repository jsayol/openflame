import { Subject } from 'rxjs/Subject';
import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/takeUntil';

import { DatabaseInternal, EventType } from './database-internal';
import { Path } from './path';
import { Reference } from './reference';
import { DataSnapshot } from './data-snapshot';

export abstract class Query {
  readonly path: Path;
  protected _queryOptions: QueryOptions = {};

  private static _offNotifier$ = new Subject<OffNotification>();

  constructor(path: string | Path = '/', protected _db: DatabaseInternal) {
    this.path = path instanceof Path ? path : new Path(path);
  }

  get ref(): Reference {
    return new Reference(this.path, this._db);
  }

  get value$() {
    return this.on('value');
  }

  get childAdded$() {
    return this.on('child_added');
  }

  get childRemoved$() {
    return this.on('child_removed');
  }

  get childChanged$() {
    return this.on('child_changed');
  }

  get childMoved$() {
    return this.on('child_moved');
  }

  orderByChild(name: string): Query {
    if (this._queryOptions.orderBy)
      throw new Error(`DatabaseQuery.orderByChild: Order already set. You can't combine multiple orderBy calls.`);

    this._queryOptions.orderBy = true;
    this._queryOptions.index = name;

    return this;
  }

  orderByKey(): Query {
    if (this._queryOptions.orderBy)
      throw new Error(`DatabaseQuery.orderByKey: Order already set. You can't combine multiple orderBy calls.`);

    this._queryOptions.orderBy = true;
    this._queryOptions.index = '.key';

    return this;
  }

  orderByValue(): Query {
    if (this._queryOptions.orderBy)
      throw new Error(`DatabaseQuery.orderByValue: Order already set. You can't combine multiple orderBy calls.`);

    this._queryOptions.orderBy = true;
    this._queryOptions.index = '.value';

    return this;
  }

  limitToFirst(limit: number): Query {
    if (this._queryOptions.limitFrom)
      throw new Error(`DatabaseQuery.limitToFirst: Limit was already set by a call to limitTo${this._queryOptions.limitFrom === 'l' ? 'First' : 'Last'}.`);

    this._queryOptions.limit = limit;
    this._queryOptions.limitFrom = 'l';

    return this;
  }

  limitToLast(limit: number): Query {
    if (this._queryOptions.limitFrom)
      throw new Error(`DatabaseQuery.limitToLast: Limit was already set by a call to limitTo${this._queryOptions.limitFrom === 'l' ? 'First' : 'Last'}.`);

    this._queryOptions.limit = limit;
    this._queryOptions.limitFrom = 'r';

    return this;
  }

  startAt(value: any): Query {
    if (typeof this._queryOptions.startAt !== 'undefined')
      throw new Error(`DatabaseQuery.startAt: Starting point was already set by another call to startAt or equalTo.`);

    this._queryOptions.startAt = value;

    return this;
  }

  endAt(value: any): Query {
    if (typeof this._queryOptions.startAt !== 'undefined')
      throw new Error(`DatabaseQuery.endAt: Ending point was already set by another call to endAt or equalTo.`);

    this._queryOptions.endAt = value;

    return this;
  }

  equalTo(value: any): Query {
    return this.startAt(value).endAt(value);
  }

  isEqual(other: Query): boolean {
    return (this._db === other._db) &&
      this.path.isEqual(other.path) &&
      (this._queryOptions.limit === other._queryOptions.limit) &&
      (this._queryOptions.limitFrom === other._queryOptions.limitFrom) &&
      (this._queryOptions.orderBy === other._queryOptions.orderBy) &&
      (this._queryOptions.index === other._queryOptions.index) &&
      (this._queryOptions.startAt === other._queryOptions.startAt) &&
      (this._queryOptions.endAt === other._queryOptions.endAt);
  }

  on(type: EventType): Observable<DataSnapshot> {
    if (type === 'child_moved') {
      throw new Error(`Reference.on: "child_moved" events are not implemented yet, sorry!`);
    }

    const on$ = Observable.create((observer: Observer<DataSnapshot>) => {
      const {listener, notifier$} = this._db.addListener(this, type);
      const subscription = notifier$.subscribe(observer);

      return () => {
        this._db.removeListener(listener);
        subscription.unsubscribe();
      }
    });

    const off$ = Query._offNotifier$
      .filter((off: OffNotification) => this.path.isEqual(off.path) && (!off.type || (type === off.type)));

    return on$.takeUntil(off$);
  }

  once(type: EventType): Observable<DataSnapshot> {
    return this.on(type).first();
  }

  /**
   * Removes all listeners of `type` on the path of this reference.
   * To remove a single listener, simply unsubscribe from it.
   *
   * @param type
   */
  off(type?: EventType) {
    Query._offNotifier$.next({
      path: this.path,
      type
    });
  }

  /**
   * @internal
   * @returns {Object}
   */
  toObject(): object | null {
    const q: object = {};
    let hasQuery = false;

    if (this._queryOptions.limitFrom) {
      q['l'] = this._queryOptions.limit;
      q['vf'] = this._queryOptions.limitFrom;
      hasQuery = true;
    }

    if (this._queryOptions.orderBy) {
      q['i'] = this._queryOptions.index;
      hasQuery = true;
    }

    if (typeof this._queryOptions.startAt !== 'undefined') {
      q['sp'] = this._queryOptions.startAt;
      hasQuery = true;
    }

    if (typeof this._queryOptions.endAt !== 'undefined') {
      q['ep'] = this._queryOptions.endAt;
      hasQuery = true;
    }

    return hasQuery ? q : null;
  }

  hasQuery(): boolean {
    return !!(
      this._queryOptions.limitFrom
      || this._queryOptions.orderBy
      || (typeof this._queryOptions.startAt !== 'undefined')
      || (typeof this._queryOptions.endAt !== 'undefined')
    );
  }

}

export interface QueryOptions {
  limit?: number;
  limitFrom?: 'l' | 'r';
  orderBy?: boolean;
  index?: string;
  startAt?: any;
  endAt?: any;
}

interface OffNotification {
  path: Path;
  type?: EventType
}
