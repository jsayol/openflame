import { Openflame } from '../core';
import { Database } from '../../../database/src/database';

declare module '../core' {
  interface Openflame {
    readonly database: Database;
  }
}

Object.defineProperty(Openflame.prototype, 'database', {
  get: (): Database => this._instances['database'] || (this._instances['database'] = new Database(this))
});