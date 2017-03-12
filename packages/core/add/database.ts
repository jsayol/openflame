import { Openflame } from '../src/core';
import { Database } from '@openflame/database';

declare module '../src/core' {
  interface Openflame {
    readonly database: Database;
  }
}

Object.defineProperty(Openflame.prototype, 'database', {
  get: function (): Database {
    return this._instances['database'] || (this._instances['database'] = new Database(this));
  }
});