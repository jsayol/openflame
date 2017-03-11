import { Openflame, OpenflameComponent, OpenflameComponentMessage } from '@openflame/core';
import { User } from './user';

import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';

import * as firebase from 'firebase/app';
import 'firebase/auth';

/**
 *
 */
export class Auth implements OpenflameComponent {
  private _firebaseApp: firebase.app.App;
  private _firebaseAuth: firebase.auth.Auth;

  constructor(public app: Openflame) {
    // FIXME: we should support multiple firebase.app.App here, not just [DEFAULT]

    try {
      this._firebaseApp = firebase.app();
    }
    catch (err) {
      this._firebaseApp = firebase.initializeApp(this.app.config);
    }

    this._firebaseAuth = firebase.auth(this._firebaseApp);

    // Subscribe to auth state changes so that we can notify other Openflame components, like the database
    this.onAuthStateChanged().subscribe((user: User) => {
      const msg: OpenflameComponentMessage = {
        app: this.app,
        from: 'auth',
        event: 'authStateChanged',
        payload: {user}
      };

      OpenflameComponent.message$.next(msg);
    });
  }

  get currentUser(): User {
    return new User(this._firebaseAuth.currentUser);
  }

  applyActionCode(code: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.applyActionCode(code);
  }

  checkActionCode(code: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.checkActionCode(code);
  }

  confirmPasswordReset(code: string, newPassword: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.confirmPasswordReset(code, newPassword);
  }

  createCustomToken(uid: string, developerClaims?: Object | null): string {
    return this._firebaseAuth.createCustomToken(uid, developerClaims);
  }

  createUserWithEmailAndPassword(email: string, password: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.createUserWithEmailAndPassword(email, password);
  }

  fetchProvidersForEmail(email: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.fetchProvidersForEmail(email);
  }

  getRedirectResult(): Promise<any> {
    return <Promise<any>>this._firebaseAuth.getRedirectResult();
  }

  onAuthStateChanged(): Observable<User> {
    return Observable.create((observer: Observer<User>) => this._firebaseAuth.onAuthStateChanged(observer));
  }

  sendPasswordResetEmail(email: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.sendPasswordResetEmail(email);
  }

  signInAnonymously(): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signInAnonymously();
  }

  signInWithCredential(credential: AuthCredential): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signInWithCredential(credential);
  }

  signInWithCustomToken(token: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signInWithCustomToken(token);
  }

  signInWithEmailAndPassword(email: string, password: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signInWithEmailAndPassword(email, password);
  }

  signInWithPopup(provider: AuthProvider): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signInWithPopup(provider);
  }

  signInWithRedirect(provider: AuthProvider): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signInWithRedirect(provider);
  }

  signOut(): Promise<any> {
    return <Promise<any>>this._firebaseAuth.signOut();
  }

  verifyIdToken(idToken: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.verifyIdToken(idToken);
  }

  verifyPasswordResetCode(code: string): Promise<any> {
    return <Promise<any>>this._firebaseAuth.verifyPasswordResetCode(code);
  }


}

export interface AuthError extends firebase.auth.Error {

}

export interface AuthProvider extends firebase.auth.AuthProvider {

}

export interface AuthCredential extends firebase.auth.AuthCredential {

}

export interface UserCredential extends firebase.auth.UserCredential {

}
