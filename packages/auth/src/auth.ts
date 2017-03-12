import { Openflame, OpenflameComponent, OpenflameComponentMessage } from '@openflame/core';
import { User } from './user';

import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/observeOn';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/partition';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/merge';
import 'rxjs/add/operator/publishBehavior';
import 'rxjs/add/operator/distinctUntilChanged';

import * as firebase from 'firebase/app';
import 'firebase/auth';

/**
 *
 */
export class Auth implements OpenflameComponent {
  public readonly authStateChanged$: Observable<User>;
  public readonly signIn$: Observable<User>;
  public readonly signOut$: Observable<User>;
  public readonly isSignedIn$: Observable<boolean>;

  private _firebaseApp: firebase.app.App;
  private _firebaseAuth: firebase.auth.Auth;
  private _currentUser: User;
  private readonly initiallySingedOut$: Observable<any>;

  constructor(public app: Openflame) {
    // FIXME: it should support multiple firebase.app.App here, not just [DEFAULT]

    try {
      this._firebaseApp = firebase.app();
    }
    catch (err) {
      this._firebaseApp = firebase.initializeApp(this.app.config);
    }

    this._firebaseAuth = firebase.auth(this._firebaseApp);

    // An observable that emits whenever there's an auth state change
    this.authStateChanged$ = Observable.create((observer: Observer<User>) => this.onAuthStateChanged(observer)).share();

    // this.authStateChanged$.subscribe((user: User) => {
    //   const msg: OpenflameComponentMessage = {
    //     app: this.app,
    //     from: 'auth',
    //     event: 'authStateChanged',
    //     payload: {user}
    //   };
    //
    //   OpenflameComponent.message$.next(msg);
    // });

    // Subscribe to auth state changes so that we can notify other Openflame components, like the database
    this.authStateChanged$
      .map<User, OpenflameComponentMessage>((user: User) => ({
          app: this.app,
          from: 'auth',
          event: 'authStateChanged',
          payload: {user}
        })
      )
      .subscribe(OpenflameComponent.message$);

    const [signOut$, initiallySingedOut$]: Array<Observable<User>> = this.authStateChanged$
      .partition((auth: User) => !auth && !!this._currentUser);

    this.initiallySingedOut$ = initiallySingedOut$
      .do((auth: User) => this._currentUser = auth);

    // An observable that emits when the user signs in
    this.signIn$ = this.authStateChanged$
      .filter((auth: User) => !!auth)
      .do((auth: User) => this._currentUser = auth)
      .share();

    // An observable that emits when the user signs out
    this.signOut$ = signOut$
      .map((auth: User) => {
        const currentAuth = this._currentUser;
        this._currentUser = auth;
        return currentAuth;
      })
      .share();

    // An observable that emits whenever there's an auth state change, telling
    // whether the user is signed in (true) or out (false). Upon subscription it
    // immediately emits the current state ("publish behavior").
    this.isSignedIn$ = this.initiallySingedOut$
      .merge(this.signIn$)
      .merge(this.signOut$)
      .map(() => !!this._currentUser)
      .publishBehavior<boolean>(void 0)
      .refCount()
      .filter((isSignedIn: boolean) => isSignedIn !== undefined)
      .distinctUntilChanged();
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

  onAuthStateChanged(nextOrObserver: Object, error?: (a: firebase.auth.Error) => any, completed?: () => any): () => any {
    return this._firebaseAuth.onAuthStateChanged(nextOrObserver, error, completed);
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
