import { DatabaseInternal } from './database-internal';
import { Query } from "./query";

export class OnDisconnect {
  private path: string;

  constructor(private query: Query, private db: DatabaseInternal) {
    this.path = query.path.toString();
  }

  set(value: any): Promise<void> {
    // TODO: should we perform any sanity checks on the value?
    return this.db
      .sendDataMessage('o', this.query, {
        p: this.path,
        d: value
      })
      .then(() => void 0);
  }

  setWithPriority(value: any, priority: number | string | null): Promise<void> {
    return this.set({
      '.value': value,
      '.priority': priority
    });
  }

  remove(): Promise<void> {
    return this.set(null);
  }

  update(values: { [k: string]: any }): Promise<void> {
    // TODO: should we perform any sanity checks on the values?
    return this.db
      .sendDataMessage('om', this.query, {
        p: this.path,
        d: values
      })
      .then(() => void 0);
  }

  cancel(): Promise<void> {
    return this.db
      .sendDataMessage('oc', this.query, {
        p: this.path,
        d: null
      })
      .then(() => void 0);
  }

}
