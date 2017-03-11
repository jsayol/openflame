/**
 * @private
 */
export class Path {
  private _parts: string[];

  constructor(path: string | string[]) {
    this._parts = typeof path === 'string' ? Path.getParts(path) : path;
  }

  get key(): string | null {
    return this._parts.length ? this._parts[this._parts.length - 1] : null;
  }

  get parent() {
    if (!this._parts.length)
      return null;

    return new Path(this._parts.slice(0, this._parts.length - 1));
  }

  get parts() {
    return this._parts.slice(0);
  }

  child(path: string, skipCheck = false): Path {
    return new Path([...this._parts, ...Path.getParts(path, skipCheck)]);
  }

  isEqual(otherPath: Path): boolean {
    return this.toString() === otherPath.toString();
  }

  /**
   * Checks if this path includes another one.
   *
   * Example 1: `new Path('/hello').includes(new Path('/hello/world')) === true`
   * Example 2: `new Path('/hello/world').includes(new Path('/hello')) === false`
   * Example 3: `new Path('/messages').includes(new Path('/users/joe')) === false`
   * Example 4: `new Path('/same').includes(new Path('/same')) === false`
   *
   * @param otherPath
   * @returns {boolean}
   */
  includes(otherPath: Path): boolean {
    if (this._parts.length >= otherPath.length)
      return false;

    return this._parts.every((part: string, i: number) => part === otherPath.partAt(i));
  }

  includesOrEqualTo(otherPath: Path): boolean {
    return this.isEqual(otherPath) || this.includes(otherPath);
  }

  toString(): string {
    return '/' + this._parts.join('/');
  }

  partAt(pos: number): string {
    return this._parts[pos];
  }

  get length(): number {
    return this._parts.length;
  }

  static getParts(path: string, skipCheck = false): string[] {
    path = Path.normalize(path);

    if (path === '')
      return [];

    return path.split('/');
  }

  static normalize(path: string, skipCheck = false): string {
    if (!skipCheck && /[\.\#\$\[\]]/.test(path)) {
      throw new Error(`Invalid path: "${path}". Paths must be non-empty strings and can't contain ".", "#", "$", "[", or "]"`);
    }

    return path.replace(/\/\/+/, '/').replace(/^\//, '').replace(/\/$/, '');
  }
}
