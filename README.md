## Note: As of version 4.0, [the official Firebase JavaScript SDK](https://github.com/firebase/firebase-js-sdk) has been opensourced! For that reason, I won't continue working on expanding or maintaning Openflame. I'm leaving the repo up as a curiosity.

# Openflame
:fire: :fire: :fire: ![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg) :fire: :fire: :fire:

## What is it?
Openflame is an RxJS-based, open-source SDK for Firebase being developed as an alternative to the official web SDK. It is not intended as a drop-in replacement.
 
## But... why?
This started just for fun, to be honest. I wanted to learn what the SDK was really doing behind the scenes and figure out how and when it communicated with the Firebase servers, so one weekend I started looking into it.

The communication part was easy. I could simply use the SDK to attach listeners, or change data, or do any other operation and then monitor the WebSocket frames being sent back an forth.

Figuring out what was actually happening on the client side, though, was trickier. The official SDK is closed-sourced and only available as a set of minified files, so I began implementing my own tiny version of it. At first it was just a playground, allowing me to send commands over the WebSocket and see and react to the server's response. But then it just kept growing and growing until I realized I was reimplementing the whole database SDK, so I decided to roll with it.


## Components
Openflame has been built with modularity in mind from the very beginning, even if only the database part of the SDK has been implemented for now. It's published as several independent packages, each adding the functionality of one the Firebase services.

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

### Using only the database:
```ts
import { Openflame } from '@openflame/core';
import { DataSnapshot } from '@openflame/database';

import '@openflame/core/add/database';

const openflame = new Openflame({
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  storageBucket: "...",
  messagingSenderId: "..."
});

const newMessage$ = openflame.database.ref('/messages').childAdded$;

newMessage$.subscribe((snap: DataSnapshot) => {
  console.log('Hey, new message! It says:', snap.child('content').val());
);
```

### Using authentication and the database:
```ts
import { Openflame } from '@openflame/core';
import { DataSnapshot } from '@openflame/database';
import { User } from '@openflame/auth';

import '@openflame/core/add/database';
import '@openflame/core/add/auth';

import 'rxjs/add/operator/takeUntil';
import 'rxjs/add/operator/switchMap';

const openflame = new Openflame({
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  storageBucket: "...",
  messagingSenderId: "..."
});

const private$ = openflame.auth.signIn$
  .switchMap((user: User) => openflame.database
    .ref(`private/${user.uid}`)
    .value$
    .takeUntil(openflame.auth.signOut$)
  );
  
private$.subscribe((snap: DataSnapshot) => {
  const displayName = openflame.auth.currentUser.displayName;
  console.log(`Private value for ${displayName}:`, snap.val())
});

```

### Bootstrapping the database with locally-stored data. 
Effectively, this allows to only receive new data and data that has changed. Use your prefered local storage solution to store and retrieve the data:
```ts
import { Openflame } from '@openflame/core';
import { DataSnapshot } from '@openflame/database';

import '@openflame/core/add/database';

const openflame = new Openflame({
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  storageBucket: "...",
  messagingSenderId: "..."
});

// You would usually retrieve this from local storage
const locallyStoredData = {
  messages: {
    '-Kdr27CeOcH5wT0Jq_Av': {
      from: 'Bob',
      content: 'Hello!'
    },
    '-KdvZFR-vkmbZoFcUaTh': {
      from: 'Alice',
      content: 'Hi there'
    },
  }
};

openflame.database.bootstrap(locallyStoredData);

const messagesRef = openflame.database.ref('/messages');

messagesRef.childAdded$.subscribe((snap: DataSnapshot) => {
  /*
   * From this point on you will only get notified of messages that you don't
   * already have.
   * Besides that, the Firebase server won't initially send data for /messages unless
   * there's been any changes, either due to new messages that you didn't have or
   * changes to the ones that you did.
   * That means you don't waste bandwidth and your users are happier :)
   */
  const msg = snap.val();
  console.log(`New message from ${msg.from}! It says: "${msg.content}"`);
);

/*
 * Let's send a new message.
 * Openflame also does optimistic updates (yay!) which means the childAdded event
 * will immediatley see the new message.
 */
messagesRef.push({
  from: 'Josep',
  content: 'Cool, huh?'
});
```

## Developing
```sh
$ git clone https://github.com/jsayol/openflame.git
$ cd openflame
$ yarn install
$ yarn run build
```
