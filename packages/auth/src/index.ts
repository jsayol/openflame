// import { Openflame } from '@openflame/core/src/core';
// import { Auth } from './auth';
//
//
// declare module '@openflame/core/src/core' {
//   interface Openflame {
//     auth: () => Auth;
//   }
// }
//
// Openflame.prototype.auth = function (): Auth {
//   if (!this._instances['auth'])
//     this._instances['auth'] = new Auth(this);
//
//   return <Auth>this._instances['auth'];
// };

export * from './auth';
export * from './user';
