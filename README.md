# Openflame
:fire: :fire: :fire: ![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg) :fire: :fire: :fire:

## What is it?
Openflame is an open source, RxJS-based SDK for Firebase being developed as an alternative to the official Web SDK. It is not intended as a drop-in replacement.
 
## But... why?
To be honest, this started just for fun. I wanted to learn what the SDK was really doing behind the scenes and figure out how and when it communicated with the Firebase servers, so one weekend I started looking into it.

The communication part was easy. I could simply use the SDK to attach listeners, or change data, or do any other operation and then monitor the WebSocket frames being sent back an forth.

Figuring out what was actually happening on the client side, though, was trickier. The official SDK is closed-sourced and only available as a set of minified files, so I began implementing my own tiny version of it. At first it was just a playground, allowing me to send commands over the WebSocket and see and react to the server's response. But then it just kept growing and growing until I realized I was reimplementing the whole database SDK, so I decided to roll with it.


## Components
Openflame has been built with modularity in mind from the very beginning, even if only the database part o the SDK has been implemented for now. It's published as several independent packages, each adding the functionality of one the Firebase services.

* #### `@openflame/core`

  This is the core component that ties everything together and offers the entry point to all the functionality. It is a required dependency.

* #### `@openflame/database`
  *Work in progress.* Written from scratch, the database component offers an Observable-based API to interact with the Firebase Realtime Database. The basics have been implemented but several features are still missing. Only WebSocket communication is supported, no long polling. It supports authentication if used together with `@openflame/auth` (see below.)
  
* #### `@openflame/auth`
  Authentication is serious business. It's really difficult to get it right but extremely easy—and painful—to mess things up. For that reason, and because I just don't have the time right now, I decided against implementing my own. `@openflame/auth` is just a wrapper around the official auth SDK, giving you access to all of its functionality but also allowing the database component to hook into authentication-related events. 

### Future components
* #### `@openflame/storage`
  ***Not implemented yet.*** Would allow access to Cloud Storage for Firebase.

* #### `@openflame/messaging`
  ***Not implemented yet.*** Would allow access to Firebase Cloud Messaging (FCM).

## Examples
```ts
import { Openflame } from '@openflame/core';
import { DataSnapshot } from '@openflame/database';
import { User } from '@openflame/auth';
import '@openflame/core/add/database';
import '@openflame/core/add/auth';

const openflame = new Openflame({
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  storageBucket: "...",
  messagingSenderId: "..."
});

// NOTE: `childAdded` hasn't been implemented yet
const newMessage$ = openflame.database.ref('/messages').childAdded$;

newMessage$.subscribe((snap: DataSnapshot) => {
  console.log(`Hey, new message! It says:`, snap.val());
);

const private$ = openflame.auth.signIn$
  .switchMap((user: User) => openflame.database
    .ref(`private/${user.uid}`)
    .value$
    .takeUntil(openflame.auth.signOut$)
  )
  
private$.subscribe((snap: DataSnapshot) => {
  const uid = openflame.auth.currentUser.uid;
  console.log(`Private value for ${uid}:`, snap.val())
});

```

## Developing
```bash
git clone https://github.com/jsayol/openflame.git
cd openflame
yarn install
yarn run build
```
