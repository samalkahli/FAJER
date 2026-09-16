const firebaseConfig = {
    apiKey: "AIzaSyCN7d0p7Wv6ACXiz_Xp3mRkzEF4g0iiXKE",
    authDomain: "athnta-gallary.firebaseapp.com",
    projectId: "athnta-gallary",
    storageBucket: "athnta-gallary.firebasestorage.app",
    messagingSenderId: "814746418768",
    appId: "1:814746418768:web:e4e08b4cee435498269b55"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

window.athntaDb =
    typeof firebase.firestore === 'function'
        ? firebase.firestore()
        : null;

window.athntaAuth =
    typeof firebase.auth === 'function'
        ? firebase.auth()
        : null;