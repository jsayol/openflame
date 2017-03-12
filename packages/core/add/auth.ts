import { Openflame } from '../core';
import { Auth } from '@openflame/auth';

declare module '../core' {
  interface Openflame {
    readonly auth: Auth;
  }
}

Object.defineProperty(Openflame.prototype, 'auth', {
  get: function (): Auth {
    return this._instances['auth'] || (this._instances['auth'] = new Auth(this));
  }
});