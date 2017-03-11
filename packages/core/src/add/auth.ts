import { Openflame } from '../core';
import { Auth } from '../../../auth/src/auth';

declare module '../core' {
  interface Openflame {
    readonly auth: Auth;
  }
}

Object.defineProperty(Openflame.prototype, 'auth', {
  get: (): Auth => this._instances['auth'] || (this._instances['auth'] = new Auth(this))
});