/* Bible Games Daily: Firebase settings.
   While this is null, accounts stay switched off and the site works without them.
   To switch accounts on, replace null with the config object from
   Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration" → Config.
   These values are meant to be public; the security rules in firestore.rules are what protect players' data.

   Example shape:
   export default {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
*/
export default null;
