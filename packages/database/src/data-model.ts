import { Path } from './path';

export class DataModel {
  private children: { [k: string]: DataModel } = {};
  private value: boolean | string | number | any[] | null = null;

  constructor(public key: string | null = null,
              public parent: DataModel | null = null,
              data: boolean | string | number | { [k: string]: any } | any[] = {}) {

    // TODO: There should be a check for circular references somewhere in here

    this.setData(data);
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
          this.children[key] = new DataModel(key, this, data[key]);
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

    if (typeof this.children[key] === 'undefined') {
      this.children[key] = new DataModel(key, this);
    }

    return this.children[key].child(new Path(parts));
  }

  clone(): DataModel {
    const clone = new DataModel();
    const childKeys = Object.getOwnPropertyNames(this.children);

    if (childKeys.length > 0) {
      // Let's not use forEach here to avoid eating too much memory with recursion
      for (let i = 0, l = childKeys.length; i < l; i++) {
        const key = childKeys[i];
        clone.children[key] = this.children[key].clone();
      }
    } else {
      clone.value = this.value;
    }

    return clone;
  }

  toObject(): Object | null {
    const childKeys = Object.getOwnPropertyNames(this.children);

    if (childKeys.length > 0) {
      const obj = {};

      // Let's not use forEach here to avoid eating too much memory with recursion
      for (let i = 0, l = childKeys.length; i < l; i++) {
        const key = childKeys[i];
        obj[key] = this.children[key].toObject();
      }

      return obj;
    }

    return this.value;
  }

  exists(): boolean {
    return this.hasChildren() || this.hasValue();
  }

  hasChildren(): boolean {
    return this.numChildren() > 0;
  }

  hasValue(): boolean {
    return this.value !== null;
  }

  numChildren(): number {
    return Object.getOwnPropertyNames(this.children).length;
  }


}
