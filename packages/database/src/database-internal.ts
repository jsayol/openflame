import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { WebSocketSubject } from 'rxjs/observable/dom/WebSocketSubject';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mapTo';
import 'rxjs/add/operator/merge';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/filter';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/observable/dom/webSocket';

import { Query } from './query';
import { Path } from './path';
import { DataModel } from './data-model';
import { DataSnapshot } from './data-snapshot';


/**
 * Which SDK version to fake
 * @type {string}
 */
const SDK_VERSION = 'sdk.js.3-7-0';

/**
 * The keep-alive period, in miliseconds
 * @type {number}
 */
const KEEPALIVE_PERIOD = 45000;

/**
 * @private
 * Internal implementation of the database SDK
 */
export class DatabaseInternal {
  private _socket$: WebSocketSubject<any>;
  private _connection: Subscription;
  private _databaseURL: string;
  private _host: string;
  private _useTLS: boolean;
  private _projectName: string;
  private _useProjectName: boolean = false;
  private _keepAliveHandler: any;
  private _serverInfo: ServerInfo = {timeDiff: 0};
  private _reqCounter: number = 1;
  private _sentRequests: { [k: number]: SentDataRequest } = {};
  private _tagCounter: number = 1;
  private _model: DataModel = new DataModel();
  private _dataListeners: Array<DataListener> = [];
  private _notifier = new Subject<NotifierEvent>();
  private _hasReceivedError = false;

  constructor(_databaseURL?: string) {
    if (!_databaseURL)
      throw new Error('No databaseURL provided in the configuration');

    this._databaseURL = _databaseURL;

    this.init();
    this.connect();
  }

  /**
   * Adds a new listener to the database, based on a `Query`
   * @param query
   * @param type
   * @returns {[DataListener,Observable<DataSnapshot>]}
   */
  addListener(query: Query, type: EventType): [DataListener, Observable<DataSnapshot>] {
    const toInactivate: any[] = [];
    let makeActive = true;

    for (let i = 0, l = this._dataListeners.length; i < l; i++) {
      const listener = this._dataListeners[i];

      if (listener.query.path.includesOrEqualTo(query.path) && !listener.query.hasQuery()) {

        // This listener has the same path as the new one or includes it, and it doesn't have a query,
        // so we don't need to make the new one active. No need to check further.
        makeActive = false;
        break;

      } else if (listener.isActive) {
        // This listener is active, we need to check wether we have to inactivate it or not

        if (query.path.includes(listener.query.path)) {
          // This listener is active and its path is included in the one being added. Check queries.

          if (!query.hasQuery()) {
            // The one being added doesn't have a query, so it's safe to inactivate the current one
            toInactivate.push(listener);
          }

        } else if (query.path.isEqual(listener.query.path)) {
          // This listener has the same path as the one being added, and (first "if") it has a query.

          if (!query.hasQuery()) {
            // The one being added doesn't have a query, so we inactivate the current one
            toInactivate.push(listener);
          }

        }
      }
    }

    const newListener = {
      query,
      type,
      isActive: makeActive,
      tag: query.hasQuery() ? this._tagCounter++ : 0
    };

    this._dataListeners.push(newListener);

    // This observable emits when we receive data from the server
    const notifier$ = this._notifier
      .filter((event: NotifierEvent): boolean => {
        // TODO: take query options into account, not just the path
        return query.path.includesOrEqualTo(event.path);
      })
      .map((/*event: NotifierEvent*/): DataSnapshot => {
        return new DataSnapshot(query, this._model.child(query.path).clone());
      })
      .share();

    // This observable emits when the watch has been added, or immediately if we're not
    // adding a watch, unless the notifier$ has already emited values
    const addWatch$ = (
      makeActive
        ? Observable.fromPromise(this.addServerWatch(query, newListener.tag))
        : Observable.of(void 0))
      .takeUntil(notifier$)
      .map(() => new DataSnapshot(query, this._model.child(query.path).clone()));

    // Inactivate any listeners marked for inactivation
    // IMPORTANT: This needs to come *after* the server watch has been added. Don't move it!
    toInactivate.forEach((listener: DataListener) => {
      listener.isActive = false;
      this.removeServerWatch(listener.query, listener.tag);
    });

    return [
      newListener,
      notifier$.merge(addWatch$)
    ];
  }

  isListenerMaskedByAnyOther(listener: DataListener) {
    const path = listener.query.path;

    return !listener.query.hasQuery() && this._dataListeners.some((other: DataListener) => {
      return (listener !== other) && path.includesOrEqualTo(other.query.path);
    });
  }

  removeListener(listenerToRemove: DataListener) {
    let shouldRemoveWatch = listenerToRemove.isActive;

    const newListenersList: DataListener[] = [];

    console.info('removeListener, listeners =', this._dataListeners);

    // Let's check if we need to remove the watch or re-activate any listener
    this._dataListeners.forEach((listener: DataListener) => {

      if (listener !== listenerToRemove) {
        newListenersList.push(listener);

        const path = listener.query.path;
        const toRemovePath = listenerToRemove.query.path;

        if (listenerToRemove.isActive && !listener.isActive && !listenerToRemove.query.hasQuery() && toRemovePath.includesOrEqualTo(path)) {
          // The listener we're removing is active and masks this one.

          if (!this.isListenerMaskedByAnyOther(listener)) {
            // This listener is not masked by any other listener, let's re-activate it
            // TODO: here's where we need to compute the hash to avoid triggering new data from the server
            listener.isActive = true;
            this.addServerWatch(listener.query, listener.tag);
          }
        }

        if (shouldRemoveWatch && path.isEqual(toRemovePath) && listener.query.isEqual(listenerToRemove.query)) {
          // This other listener has the same path and same query as the one we're removing,
          // so we can't remove the server watch
          shouldRemoveWatch = false;
        }

      }

    });

    if (shouldRemoveWatch) {
      this.removeServerWatch(listenerToRemove.query, listenerToRemove.tag);
    }

    this._dataListeners = newListenersList;

    // TODO: check model, we might be able to delete parts of it at this point

  }

  sendDataMessage(type: string, query: Query | null, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this._reqCounter++;
      const data = {
        r: id,
        a: type,
        b: payload
      };

      this._sentRequests[id] = {
        resolve,
        reject,
        data,
        query
      };

      this.send({
        t: 'd',
        d: data
      });
    });
  }

  get timeDiff(): number {
    return this._serverInfo.timeDiff;
  }

  private resendDataMessage(req: SentDataRequest) {
    const id = this._reqCounter++;
    req.data['r'] = id;

    this._sentRequests[id] = {
      resolve: req.resolve,
      reject: req.reject,
      data: req.data,
      query: req.query
    };

    this.send({
      t: 'd',
      d: req.data
    });
  }

  private addServerWatch(query: Query, tag: number): Promise<any> {
    const payload = {
      /* The path (duh) */
      p: query.path.toString(),

      /*
       This seems to be some sort of base64-encoded hash.
       I suspect it's used when attaching a listener to a path for which we already
       have data. As in, "here's what I have, don't resend the data if it's still the same".
       I'll have to figure out how this hash is computed... which means having to
       debug minified code. Sigh.
       EDIT: maybe it's something else? Even when the official SDK passes this hash, the server always
       returns the data even if it hasn't changed. Strange...
       EDIT 2: it's a bug on the web SDK. It's sending the wrong hash if the listener has a query.
       */
      h: ''
    };

    if (tag) {
      /*
       Querying parameters. If "q" is present then "t" is also present.
       q.l = limit, how many values to get
       q.vf = "values from"? It's either "r" (right, limitToLast) or "l" (left, limitToFirst)
       q.i: index used. Can be ".key" (orderByKey), ".value" (orderByValue), or the name of a child key (orderByChild)
       */
      payload['q'] = query.toObject();

      /*
       The SDK calls this the "tag". Since there can be more than one listener attached to
       the same path with different queries, this tag is used to uniquely identify data events
       associated with a listener that has a query... right?
       */
      payload['t'] = tag;
    }

    return this.sendDataMessage('q', null, payload);
  }

  private removeServerWatch(query: Query, tag: number) {
    const payload = {
      p: query.path.toString(),
    };

    if (tag) {
      payload['t'] = tag;
      payload['q'] = query.toObject();
    }

    this.sendDataMessage('n', null, payload);
  }

  private init() {
    const dbURLmatch = this._databaseURL.trim().match(/^http(s?):\/\/(([^\.]+)\.(.+))$/);

    if (!dbURLmatch) {
      throw new Error('Missing or malformed databaseURL in config');
    }

    this._useTLS = dbURLmatch[1] === 's';
    this._projectName = dbURLmatch[3];

    const savedHost = localStorage.getItem(`firebase:host:${dbURLmatch[2]}`);

    if (savedHost) {
      this._host = JSON.parse(savedHost);
      this._useProjectName = true;
    } else {
      this._host = dbURLmatch[2];
    }
  }

  private connect() {
    let url = `ws${this._useTLS ? 's' : ''}://${this._host}/.ws?v=5` + (this._useProjectName ? `&ns=${this._projectName}` : '');

    this._socket$ = Observable.webSocket<any>(url);

    this._connection = this._socket$.subscribe(
      (msg: Object) => this.processMessage(msg),
      (err: any) => console.error('WebSocket error:', err),
      () => console.info('WebSocket closed')
    );

    this.scheduleKeepAlive();
  }

  private disconnect() {
    // RxJS magic!
    !this._connection.closed && this._connection.unsubscribe();
  }

  private handleReset(host) {
    this.disconnect();

    if (this._host === host) {
      console.warn('The Firebase server is requesting a reconnect to the current host. Aborting.');
      return;
    }

    const currentHost = this._host;

    this._host = host;
    this._useProjectName = true;

    localStorage.setItem(`firebase:host:${currentHost}`, JSON.stringify(host));

    setTimeout(() => this.connect(), 1000);
  }

  private scheduleKeepAlive() {
    // Clear the keep-alive timeout, if any
    this._keepAliveHandler && clearTimeout(this._keepAliveHandler);

    // Schedule a keep-alive message
    this._keepAliveHandler = setTimeout(() => this.send(0), KEEPALIVE_PERIOD);
  }

  private send(data) {
    this._socket$.next(JSON.stringify(data));
    this.scheduleKeepAlive();
  }

  private processMessage(msg: Object) {
    // console.log(JSON.stringify(msg, null, 2));

    switch (msg['t']) {
      case 'c':
        this.processConnectionMessage(msg);
        break;
      case 'd':
        this.processDataMessage(msg);
        break;
      default:
        console.info('Unknown message type:', msg);
    }
  }

  private processConnectionMessage(msg: Object) {
    const data: Object = msg['d'];

    switch (data['t']) {

      case 'r':
        // Reconnect
        this.handleReset(data['d']);
        break;

      case 'h':
        // Handshake?
        this.handleHandshake(data, Date.now());
        break;

      case 'a':
        // I think this is the server requesting an ACK from the client
        // Let's send a ping
        this.send({
          t: 'c',
          d: {
            t: 'p',
            d: {}
          }
        });
        break;

      case 'o':
        // A pong from the server, responding to our ping
        // Let's send the ACK back to the server
        this.send({
          t: 'c',
          d: {
            t: 'a',
            d: {}
          }
        });
        break;

      case 'e':
        // Error message
        this._hasReceivedError = true;
        const err = data['d'].match(/^ClientId\[(.+)]:ErrorId\[(.+)]: (.+)$/);
        console.error(`FIREBASE ERROR! ClientId=${err[1]} - ErrorId=${err[2]} - ${err[3]}`);
        break;

      default:
        console.info('Unknown connection message:', msg);
    }
  }

  private processDataMessage(msg: Object) {
    const data: Object = msg['d'];

    if (data['r']) {
      const reqNumber: number = data['r'];
      const response: Object = data['b'];

      // Check if there's any older request awaiting response
      const hadPending = this.checkPendingRequests(reqNumber);

      if (!hadPending && this._hasReceivedError) {
        this._hasReceivedError = false;
      }

      if (this._sentRequests[reqNumber]) {
        const request = this._sentRequests[reqNumber];
        const status: string = response['s'];

        if (status === 'ok') {
          const responseData: Object = response['d'];

          // console.info(`Response(r=${reqNumber}):`, responseData);
          request.resolve(response['d']);

          if (responseData['w']) {
            // The server is returning one or more warnings
            const warnings = <Array<string>> responseData['w'];
            this.processDataMessageWarnings(reqNumber, warnings);
          }

        } else {
          // console.error(`Response(r=${reqNumber}) error:`, msg);
          const path = request.query ? ' at ' + request.query.path.toString() : '';

          // TODO: should we do something with these errors, other than reject the request?
          request.reject(new Error(`${status}${path}: ${response['d']}`));
        }

        delete this._sentRequests[reqNumber];
      }

    } else if (data['a']) {
      switch (data['a']) {

        case 'd':
          // New data for a specific key ("set" operation)
          this.processData(data['b']);
          break;

        case 'm':
          // Multipath update
          // this.processMultipathData(data['b']);
          break;

        case 'ac':
          // Authentication?
          console.log('Auth message received:', data['b']);
          break;

        default:
          console.info('Unknown data message (a):', msg);
      }
    }

  }

  /**
   * Responses always arrive in the same order they were sent. If we have a request with id number N awaiting a
   * response and at some point we get a response for a request with an id number larger than N, that means
   * that request has been skipped or lost for some reason (network error?). Let's resend those.
   *
   * TODO: is this how the official SDK handles this situation? Look into it.
   *
   * @param reqNumber
   */
  private checkPendingRequests(reqNumber) {
    const pending: SentDataRequest[] = [];

    Object.keys(this._sentRequests)
      .forEach((id: string) => {
        if (parseInt(id) < reqNumber) {
          // Before resending the requests we need to remove them from the registry, otherwise
          // we might enter an infinite resend loop.
          // Also: don't resend if we've just received an error.

          if (!this._hasReceivedError) {
            pending.push(this._sentRequests[id]);
          }

          delete this._sentRequests[id];
        }
      });

    pending.forEach((req: SentDataRequest) => this.resendDataMessage(req));
  }

  private handleHandshake(data: any, now: number) {
    const d = data['d'];

    this._serverInfo = {
      v: d['v'], // Version number? No idea
      host: d['h'],
      timeDiff: now - d['ts'],
      sessionKey: d['s'],
    };

    this.sendDataMessage('s', null, {
      c: {
        [SDK_VERSION]: 1
      }
    });

  }

  private processData(data: any) {
    // The path for the data we're recieving
    const path = new Path(data['p']);

    // The value of the new data
    const value: any = data['d'];

    // Query "tag"
    // const tag: number = data['t'];

    this._model.child(path).setData(value);

    /*
     TODO: Actually implement approach 1
     TODO: Figure out which approach is best:
     1. Current, naive approach: emit every single possible event and let the listeners' notifiers filter them out.
     2. Queue the events and later loop through all the listeners to figure out which ones we need to emit

     The current one is more flexible, but it might not offer very good performance with large updates and lots of listeners.
     I should probably do some complexity calculations to figure it out, and some perf benchmarking wouldn't hurt.
     */
    this._notifier.next({
      path,
      data: value
    });
  }

  private processDataMessageWarnings(reqNumber: number, warnings: string[]) {
    const req = this._sentRequests[reqNumber].data;

    warnings.forEach((warning: string) => {
      switch (warning) {
        case 'no_index':
          console.warn(`FIREBASE WARNING: Using an unspecified index. Consider adding ".indexOn": "${req['q']['i']}" at ${req['b']['p']} to your security rules for better performance`);
          break;
        default:
          console.warn(`FIREBASE WARNING ("${warning}"):`, req);
      }
    });
  }

}

/**
 *
 */
export interface ServerInfo {
  timeDiff: number;
  host?: string;
  sessionKey?: string;
  v?: string;
}

/**
 *
 */
export type EventType =
  'value'
  | 'child_added'
  | 'child_removed'
  | 'child_moved'
  | 'child_changed';

/**
 *
 */
export interface NotifierEvent {
  path: Path;
  data: any;
}

/**
 *
 */
interface SentDataRequest {
  resolve: (val) => void;
  reject: (val) => void;
  data: any;
  query: Query | null;
}

/**
 *
 */
export interface DataListener {
  query: Query;
  type: EventType;
  isActive: boolean;
  tag: number;
}