import { Path } from './path';

/**
 * @internal
 */
export class DataModel {
  private _children: { [k: string]: DataModel } = {};
  private value: boolean | string | number | any[] | null = null;

  constructor(public key: string | null = null,
              public parent: DataModel | null = null,
              data: boolean | string | number | { [k: string]: any } | any[] = {}) {

    // TODO: There should be a check for circular references somewhere in here

    this.setData(data);
  }

  get root(): DataModel {
    let model: DataModel = this;

    while (model.parent) model = model.parent;

    return model;
  }

  get children(): DataModel[] {
    return Object.getOwnPropertyNames(this._children).map((key: string) => this._children[key]);
  }

  setData(data: boolean | string | number | { [k: string]: any } | any[]): DataModel {

    if (data === null) {
      this.value = null;
    } else if (typeof data === 'boolean' || typeof data === 'string' || typeof data === 'number' || data instanceof Array) {
      this.value = data;
    } else {
      this.value = null;

      for (let key in data) {
        if (data.hasOwnProperty(key) && (data[key] !== null)) {
          this._children[key] = new DataModel(key, this, data[key]);
        }
      }
    }

    return this;
  }

  child(path: Path | string): DataModel {
    if (typeof path === 'string') {
      path = new Path(path);
    }

    const parts = path.parts;

    if (parts.length === 0)
      return this;

    const key = <any>parts.shift();

    if (typeof this._children[key] === 'undefined') {
      this._children[key] = new DataModel(key, this);
    }

    return this._children[key].child(new Path(parts));
  }

  clone(): DataModel {
    const clone = new DataModel(this.key, this.parent);
    const childKeys = Object.getOwnPropertyNames(this._children);

    if (childKeys.length > 0) {
      // Let's not use forEach here to avoid eating too much memory with recursion
      for (let i = 0, l = childKeys.length; i < l; i++) {
        const key = childKeys[i];
        clone._children[key] = this._children[key].clone();
      }
    } else {
      clone.value = this.value;
    }

    return clone;
  }

  toObject(): object | boolean | string | number | any[] | null {
    const childKeys = Object.getOwnPropertyNames(this._children);

    if (childKeys.length > 0) {
      const obj = {};

      // Let's not use forEach here to avoid eating too much memory with recursion
      for (let i = 0, l = childKeys.length; i < l; i++) {
        const key = childKeys[i];
        obj[key] = this._children[key].toObject();
      }

      return obj;
    }

    return this.value;
  }

  exists(): boolean {
    if (this.hasValue())
      return true;

    if (this.hasChildren()) {
      return Object.getOwnPropertyNames(this._children).some((key: string) => this._children[key].exists());
    }

    return false;
    // return this.hasValue() || (this.hasChildren() && this._children);
  }

  hasChild(key: string): boolean {
    const child = this._children[key];
    return child && child.exists();
  }

  hasChildren(): boolean {
    return this.numChildren() > 0;
  }

  hasValue(): boolean {
    return this.value !== null;
  }

  numChildren(): number {
    return Object.getOwnPropertyNames(this._children).length;
  }


}
