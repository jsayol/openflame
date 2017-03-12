import { Openflame } from '../src/core';
import { Auth } from '@openflame/auth';

declare module '../src/core' {
  interface Openflame {
    readonly auth: Auth;
  }
}

Object.defineProperty(Openflame.prototype, 'auth', {
  get: function (): Auth {
    return this._instances['auth'] || (this._instances['auth'] = new Auth(this));
  }
});