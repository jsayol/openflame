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
              data?: boolean | string | number | { [k: string]: any } | any[]) {

    // TODO: There should be a check for circular references somewhere in here

    if (typeof data !== 'undefined') {
      this.setData(data);
    }
  }

  /**
   * Returns the root of this data model
   * @returns {DataModel}
   */
  get root(): DataModel {
    let model: DataModel = this;

    while (model.parent) model = model.parent;

    return model;
  }

  /**
   * Returns the children for this data model
   * @returns {[DataModel,DataModel,DataModel,DataModel,DataModel]}
   */
  get children(): DataModel[] {
    return Object.getOwnPropertyNames(this._children).map((key: string) => this._children[key]);
  }

  /**
   * Returns the current path where this data model resides
   * @returns {Path}
   */
  get path(): Path {
    const parts: string[] = [];

    for (let model = <DataModel>this; model && model.key !== null; model = model.parent) {
      parts.unshift(model.key)
    }

    return new Path(parts);
  }

  /**
   * Sets the data for this data model
   * @param data
   * @param invalidateAncestorHashes
   * @returns {DataModel}
   */
  setData(data: boolean | string | number | { [k: string]: any } | any[], invalidateAncestorHashes = true): DataModel {
    let removeSelf = false;

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

    this._children = {};

    if (data === null) {
      removeSelf = true;
      this._value = null;
    } else if (typeof data === 'boolean' || typeof data === 'string' || typeof data === 'number' || data instanceof Array) {
      this._value = data;
    } else {
      this._value = null;
      Object.getOwnPropertyNames(data).forEach((key: string) => this.child(key).setData(data[key], false));
    }

    // Invalidate the hash for this model
    if (this._hash) {
      this._hash = null;
    }

    if (invalidateAncestorHashes) {
      // Invalidate the hashes for all this model's ancestors
      for (let model = this.parent; model; model = model.parent) {
        if (model._hash) {
          model._hash = null;
        }
      }
    }

    if (removeSelf && this.parent) {
      this.parent.removeChild(this.key);
    }

    return this;
  }

  child(path: Path | string | string[]): DataModel {
    let parts: string[];

    if (typeof path === 'string') {
      parts = Path.getParts(path);
    } else if (path instanceof Path) {
      parts = path.parts;
    } else {
      parts = path;
    }

    if (parts.length === 0)
      return this;

    const key = parts.shift();

    if (typeof this._children[key] === 'undefined') {
      this._children[key] = new DataModel(key, this);
    }

    const childModel = this._children[key];

    if (parts.length === 0)
      return childModel;

    return childModel.child(parts);
  }

  removeChild(key: string) {
    delete this._children[key];
  }

  clone({parent = this.parent, keepData = true, shallow = false}: CloneOptions = {}): DataModel {
    const clone = new DataModel(this.key, parent);

    if (keepData) {
      if (this.hasValue()) {
        clone._value = this._value;
      } else if (!shallow) {
        this.forEachChild((key: string, child: DataModel) => {
          clone._children[key] = child.clone({parent: clone});
        });
      }
    }

    return clone;
  }

  /**
   * Clones a node's branch all the way up to the root, and returns the new root
   * @returns {DataModel}
   */
  cloneToRoot(): DataModel {
    const currentParent = this.parent;

    if (!currentParent)
      return this;

    this.parent = currentParent.clone({shallow: true});
    this.parent._children[this.key] = this;

    currentParent.forEachChild((key: string, child: DataModel) => {
      if (key !== this.key) {
        this.parent._children[key] = child;
      }
    });

    return this.parent.cloneToRoot();
  }

  toObject(): object | boolean | string | number | any[] | null {
    if (this.hasValue()) {
      return this._value;
    }

    const obj = {};
    let hasValidChildren = false;

    this.forEachChild((key: string, child: DataModel) => {
      const value = child.toObject();
      if (value !== null) {
        obj[key] = value;
        hasValidChildren = true;
      }
    });

    return hasValidChildren ? obj : null;
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
    const childKeys = Object.getOwnPropertyNames(this._children);
    return childKeys.reduce((acc, val) => this._children[val].exists() ? acc + 1 : acc, 0);
  }

  forEachChild(fn: (key: string, child: DataModel) => any) {
    const childKeys = Object.getOwnPropertyNames(this._children).sort();

    for (let i = 0, l = childKeys.length; i < l; i++) {
      let child = this._children[childKeys[i]];
      if (child.exists()) {
        fn(childKeys[i], child);
      }
    }
  }

  /**
   * Returns true if the two models contain the same data, false otherwise
   * @param other
   * @returns {any}
   */
  isEqual(other: DataModel): boolean {
    if (!other)
      return false;

    if (this.hasValue() || other.hasValue())
      return this._value === other._value;

    const seenKeys: { [k: string]: true } = {};

    const thisChildrenEqual = Object.getOwnPropertyNames(this._children).every((key: string) => {
      seenKeys[key] = true;
      const thisChild = this._children[key];
      return !thisChild.exists() || thisChild.isEqual(other._children[key]);
    });

    if (!thisChildrenEqual)
      return false;

    return Object.getOwnPropertyNames(other._children).every((key: string) => {
      return seenKeys[key] || !other._children[key].exists();
    });
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

interface CloneOptions {
  parent?: DataModel;
  keepData?: boolean;
  shallow?: boolean;
}
