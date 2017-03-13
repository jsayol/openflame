import { Subject } from 'rxjs/Subject';
import { Subscriber } from 'rxjs/Subscriber';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/takeUntil';

import { DatabaseInternal, EventType } from './database-internal';
import { Path } from './path';
import { Reference } from './reference';
import { DataSnapshot } from './data-snapshot';

export abstract class Query {
  protected queryOptions: QueryOptions = {};
  readonly path: Path;
  private static _offNotifier$ = new Subject<OffNotification>();

  constructor(path: string | Path = '/', protected db: DatabaseInternal) {
    this.path = path instanceof Path ? path : new Path(path);
  }

  get ref(): Reference {
    return new Reference(this.path, this.db);
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
    if (this.queryOptions.orderBy)
      throw new Error(`DatabaseQuery.orderByChild: Order already set. You can't combine multiple orderBy calls.`);

    this.queryOptions.orderBy = true;
    this.queryOptions.index = name;

    return this;
  }

  orderByKey(): Query {
    if (this.queryOptions.orderBy)
      throw new Error(`DatabaseQuery.orderByKey: Order already set. You can't combine multiple orderBy calls.`);

    this.queryOptions.orderBy = true;
    this.queryOptions.index = '.key';

    return this;
  }

  orderByValue(): Query {
    if (this.queryOptions.orderBy)
      throw new Error(`DatabaseQuery.orderByValue: Order already set. You can't combine multiple orderBy calls.`);

    this.queryOptions.orderBy = true;
    this.queryOptions.index = '.value';

    return this;
  }

  limitToFirst(limit: number): Query {
    if (this.queryOptions.limitFrom)
      throw new Error(`DatabaseQuery.limitToFirst: Limit was already set by a call to limitTo${this.queryOptions.limitFrom === 'l' ? 'First' : 'Last'}.`);

    this.queryOptions.limit = limit;
    this.queryOptions.limitFrom = 'l';

    return this;
  }

  limitToLast(limit: number): Query {
    if (this.queryOptions.limitFrom)
      throw new Error(`DatabaseQuery.limitToLast: Limit was already set by a call to limitTo${this.queryOptions.limitFrom === 'l' ? 'First' : 'Last'}.`);

    this.queryOptions.limit = limit;
    this.queryOptions.limitFrom = 'r';

    return this;
  }

  startAt(value: any): Query {
    if (typeof this.queryOptions.startAt !== 'undefined')
      throw new Error(`DatabaseQuery.startAt: Starting point was already set by another call to startAt or equalTo.`);

    this.queryOptions.startAt = value;

    return this;
  }

  endAt(value: any): Query {
    if (typeof this.queryOptions.startAt !== 'undefined')
      throw new Error(`DatabaseQuery.endAt: Ending point was already set by another call to endAt or equalTo.`);

    this.queryOptions.endAt = value;

    return this;
  }

  equalTo(value: any): Query {
    return this.startAt(value).endAt(value);
  }

  isEqual(other: Query): boolean {
    return (this.db === other.db) &&
      this.path.isEqual(other.path) &&
      (this.queryOptions.limit === other.queryOptions.limit) &&
      (this.queryOptions.limitFrom === other.queryOptions.limitFrom) &&
      (this.queryOptions.orderBy === other.queryOptions.orderBy) &&
      (this.queryOptions.index === other.queryOptions.index) &&
      (this.queryOptions.startAt === other.queryOptions.startAt) &&
      (this.queryOptions.endAt === other.queryOptions.endAt);
  }

  on(type: EventType): Observable<DataSnapshot> {
    if (type === 'child_moved') {
      throw new Error(`Reference.on: "child_moved" events are not implemented yet, sorry!`);
    }

    const on$ = new Observable((subscriber: Subscriber<any>) => {
      const [listener, notifier$] = this.db.addListener(this, type);
      const subscription = notifier$.subscribe(subscriber);

      return () => {
        console.log(`Tearing down "${type}" for`, this);
        this.db.removeListener(listener);
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

    if (this.queryOptions.limitFrom) {
      q['l'] = this.queryOptions.limit;
      q['vf'] = this.queryOptions.limitFrom;
      hasQuery = true;
    }

    if (this.queryOptions.orderBy) {
      q['i'] = this.queryOptions.index;
      hasQuery = true;
    }

    if (typeof this.queryOptions.startAt !== 'undefined') {
      q['sp'] = this.queryOptions.startAt;
      hasQuery = true;
    }

    if (typeof this.queryOptions.endAt !== 'undefined') {
      q['ep'] = this.queryOptions.endAt;
      hasQuery = true;
    }

    return hasQuery ? q : null;
  }

  hasQuery(): boolean {
    return !!(
      this.queryOptions.limitFrom
      || this.queryOptions.orderBy
      || (typeof this.queryOptions.startAt !== 'undefined')
      || (typeof this.queryOptions.endAt !== 'undefined')
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
