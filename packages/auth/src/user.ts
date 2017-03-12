import { AuthCredential, AuthProvider } from './auth';
import * as firebase from 'firebase/app';

export class User implements firebase.User {
  private static _instances: { [uid: string]: User } = {};

  /**
   * Gets the `User` instance given a `firebase.User`, or creates a new one if it doesn't exist.
   * It prevents creating a new `User` instance every time openflame.auth.currentUser is called.
   * @param firebaseUser
   * @returns {User}
   * @private
   */
  static _get(firebaseUser: firebase.User): User {
    return this._instances[firebaseUser.uid] || (this._instances[firebaseUser.uid] = new User(firebaseUser));
  }

  constructor(private _firebaseUser: firebase.User) {
  }


  /*
   firebase.UserInfo getters
   */

  get displayName(): string | null {
    return this._firebaseUser.displayName;
  }

  get email(): string | null {
    return this._firebaseUser.email;
  }

  get photoURL(): string | null {
    return this._firebaseUser.photoURL;
  }

  get providerId(): string {
    return this._firebaseUser.providerId;
  }

  get uid(): string {
    return this._firebaseUser.uid;
  }


  /*
   firebase.User getters
   */

  get emailVerified(): boolean {
    return this._firebaseUser.emailVerified;
  }

  get isAnonymous(): boolean {
    return this._firebaseUser.isAnonymous;
  }

  get providerData(): (UserInfo | null)[] {
    return this._firebaseUser.providerData;
  }

  get refreshToken(): string {
    return this._firebaseUser.refreshToken;
  }


  /*
   firebase.User methods
   */

  delete(): Promise<any> {
    return <Promise<any>>this._firebaseUser.delete();
  }

  getToken(forceRefresh?: boolean): Promise<any> {
    return <Promise<any>>this._firebaseUser.getToken();
  }

  link(credential: AuthCredential): Promise<any> {
    return <Promise<any>>this._firebaseUser.link(credential);
  }

  linkWithPopup(provider: AuthProvider): Promise<any> {
    return <Promise<any>>this._firebaseUser.linkWithPopup(provider);
  }

  linkWithRedirect(provider: AuthProvider): Promise<any> {
    return <Promise<any>>this._firebaseUser.linkWithRedirect(provider);
  }

  reauthenticate(credential: AuthCredential): Promise<any> {
    return <Promise<any>>this._firebaseUser.reauthenticate(credential);
  }

  reload(): Promise<any> {
    return <Promise<any>>this._firebaseUser.reload();
  }

  sendEmailVerification(): Promise<any> {
    return <Promise<any>>this._firebaseUser.sendEmailVerification();
  }

  toJSON(): Object {
    return <Promise<any>>this._firebaseUser.toJSON();
  }

  unlink(providerId: string): Promise<any> {
    return <Promise<any>>this._firebaseUser.unlink(providerId);
  }

  updateEmail(newEmail: string): Promise<any> {
    return <Promise<any>>this._firebaseUser.updateEmail(newEmail);
  }

  updatePassword(newPassword: string): Promise<any> {
    return <Promise<any>>this._firebaseUser.updatePassword(newPassword);
  }

  updateProfile(profile: { displayName: string | null, photoURL: string | null }): Promise<any> {
    return <Promise<any>>this._firebaseUser.updateProfile(profile);
  }

}

export interface UserInfo extends firebase.UserInfo {

}