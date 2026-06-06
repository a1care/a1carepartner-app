import { registerRootComponent } from 'expo';

import App from './App';
import { getFirebaseMessaging } from './lib/nativeFirebase';

// Register background handler
const messaging = getFirebaseMessaging();
if (messaging) {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Message handled in the background!', remoteMessage);
  });
}

registerRootComponent(App);
