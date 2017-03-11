import { Subject } from 'rxjs/Subject';

export class Openflame {
  //noinspection JSUnusedLocalSymbols,JSMismatchedCollectionQueryUpdate
  private _instances: { [k: string]: OpenflameComponent } = {};

  constructor(public config: OpenflameConfig) {
  }

}

export abstract class OpenflameComponent {
  // A subject used to allow communication betwen components
  static message$ = new Subject<OpenflameComponentMessage>();

}

export interface OpenflameConfig {
  apiKey?: string;
  authDomain?: string;
  databaseURL?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface OpenflameComponentMessage {
  app: Openflame;
  from: string;
  to?: string;
  event: string;
  payload?: any;
}
