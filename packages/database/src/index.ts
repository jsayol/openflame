// import { Openflame } from '@openflame/core';
// import { Database } from './database';
//
// declare module '@openflame/core' {
//   interface Openflame {
//     database: () => Database;
//   }
// }
//
// Openflame.prototype.database = function (): Database {
//   if (!this._instances['database'])
//     this._instances['database'] = new Database(this);
//
//   return <Database>this._instances['database'];
// };

export * from './database';
