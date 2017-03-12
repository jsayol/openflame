import { Openflame } from '../core';
import { Database } from '@openflame/database';

declare module '../core' {
  interface Openflame {
    readonly database: Database;
  }
}

Object.defineProperty(Openflame.prototype, 'database', {
  get: function (): Database {
    return this._instances['database'] || (this._instances['database'] = new Database(this));
  }
});