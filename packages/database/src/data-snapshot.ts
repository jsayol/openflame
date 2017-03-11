import { Query } from './query';
import { Reference } from './reference';
import { DataModel } from './data-model';

export class DataSnapshot {
  private _ref: Reference;

  constructor(private _query: Query,
              private _model: DataModel) {
  }

  get key(): string | null {
    return this._ref.key;
  }

  get ref(): Reference {
    return this._ref || (this._ref = this._query.ref);
  }

  child(path: string): DataSnapshot {
    return new DataSnapshot(this.ref.child(path), this._model.child(path));
  }

  exists(): boolean {
    return this._model.hasChildren() || this._model.hasValue();
  }

  exportVal(): any {
    throw new Error('DataSnapshot.exportVal: Not implemented yet');
  }

  forEach(): boolean {
    throw new Error('DataSnapshot.forEach: Not implemented yet');
  }

  getPriority(): any {
    throw new Error('DataSnapshot.getPriority: Not implemented yet');
  }

  hasChild(path: string): boolean {
    return this._model.child(path).exists();
  }

  hasChildren(): boolean {
    return this._model.hasChildren();
  }

  numChildren(): number {
    return this._model.numChildren();
  }

  toJSON(): string {
    return JSON.stringify(this.val());
  }

  val(): Object | null {
    return this._model.toObject();
  }

}