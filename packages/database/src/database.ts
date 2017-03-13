import { Openflame, OpenflameComponent, OpenflameComponentMessage } from '@openflame/core';
import { Reference } from './reference';
import { DatabaseInternal } from './database-internal';
import 'rxjs/add/operator/filter';

/**
 *
 */
export class Database implements OpenflameComponent {
  private db: DatabaseInternal;

  constructor(public app: Openflame) {
    this.db = new DatabaseInternal(app.config.databaseURL);

    // Subscribe to messages from other components
    OpenflameComponent.message$
      .filter((msg: OpenflameComponentMessage) => (msg.app === this.app) && (!msg.to || (msg.to === 'database')))
      .subscribe((msg: OpenflameComponentMessage) => this.processComponentMessage(msg));
  }

  ref(path?: string): Reference {
    return new Reference(path, this.db);
  }

  refFromURL(url: string): Reference {
    throw new Error('Database.refFromURL: not implemented yet');
  }

  goOffline(): void {
    throw new Error('Database.goOffline: not implemented yet');
  }

  goOnline(): void {
    throw new Error('Database.goOnline: not implemented yet');
  }

  private processComponentMessage(msg: OpenflameComponentMessage) {
    switch (msg.from) {

      case 'auth':

        switch (msg.event) {
          case 'authStateChanged':
            // The user has authenticated, let's reflect that on the database
            const user: any = msg.payload.user;
            if (user) {
              user.getToken().then(token => this.db.sendDataMessage('auth', null, {
                cred: token
              }));
            }
            break;
        }
        break;

    }
  }

}

