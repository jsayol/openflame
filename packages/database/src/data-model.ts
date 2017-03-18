import { Path } from './path';
import { toIEEE754Hex } from './utils/number';
import { base64Sha1 } from './utils/base64';

/**
 * @internal
 */
export class DataModel {
  private _children: { [k: string]: DataModel } = {};
  private _value: boolean | string | number | any[] | null = null;
  private _hash: string | null = null;

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
    // TODO: transform Firebase array-like objects to actual arrays: {"0":"abc", "1":"def"} to ["abc", "def"]

    if (data && (typeof data['.value'] !== 'undefined')) {
      /*
       If a priority has been set at a certain path, its format isn't {"some key": "some value"}
       but instead it's {"some key": {".priority": "some priority", ".value": "some value"} }
       For now we ignore the priority.
       TODO: handle priorities... maybe?
       */
      data = data['.value'];
    }

    if (data === null) {
      this._value = null;
    } else if (typeof data === 'boolean' || typeof data === 'string' || typeof data === 'number' || data instanceof Array) {
      this._value = data;
    } else {
      this._value = null;

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
      for (let i = 0, l = childKeys.length; i < l; i++) {
        const key = childKeys[i];
        clone._children[key] = this._children[key].clone();
      }
    } else {
      clone._value = this._value;
    }

    return clone;
  }

  toObject(): object | boolean | string | number | any[] | null {
    const childKeys = Object.getOwnPropertyNames(this._children);

    if (childKeys.length > 0) {
      const obj = {};

      for (let i = 0, l = childKeys.length; i < l; i++) {
        const key = childKeys[i];
        obj[key] = this._children[key].toObject();
      }

      return obj;
    }

    return this._value;
  }

  exists(): boolean {
    if (this.hasValue()) {
      return true;
    }

    if (this.hasChildren()) {
      return Object.getOwnPropertyNames(this._children).some((key: string) => this._children[key].exists());
    }

    return false;
  }

  hasChild(key: string): boolean {
    const child = this._children[key];
    return child && child.exists();
  }

  hasChildren(): boolean {
    return this.numChildren() > 0;
  }

  hasValue(): boolean {
    return this._value !== null;
  }

  numChildren(): number {
    return Object.getOwnPropertyNames(this._children).length;
  }

  forEachChild(fn: (key: string, child: DataModel) => any) {
    const childKeys = Object.getOwnPropertyNames(this._children).sort();

    for (let i = 0, l = childKeys.length; i < l; i++) {
      fn(childKeys[i], this._children[childKeys[i]]);
    }
  }

  get hash(): string {
    if (!this._hash) {
      this._hash = this.hasChildren() ? this._getObjectHash() : this._getValueHash();
    }

    return this._hash;
  }

  private _getValueHash(): string {
    if (this._value === null) {
      return '';
    }

    const valueType = typeof this._value;
    const str = valueType + ':' + ((valueType === 'number') ? toIEEE754Hex(<number>this._value) : this._value);
    return base64Sha1(str);
  }

  private _getObjectHash(): string {
    let str = '';

    this.forEachChild((key: string, child: DataModel) => {
      const hash = child.hash;
      if (hash !== '') {
        str += `:${key}:${hash}`;
      }
    });

    return str !== '' ? base64Sha1(str) : '';
  }


}
