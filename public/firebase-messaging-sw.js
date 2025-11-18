// Asegúrate de usar los imports de compatibilidad
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-messaging-compat.js');

// 🚨 REEMPLAZA CON TUS CLAVES REALES DE FIREBASE 🚨
const firebaseConfig = {
    apiKey: "AIzaSyCAsTQl_uOZwupLwOJjBZZJKWkGd5YVhXs", 
    authDomain: "mi-menu-app-9c084.firebaseapp.com",
    projectId: "mi-menu-app-9c084", // Este es tu ID de proyecto
    storageBucket: "mi-menu-app-9c084.firebasestorage.app",
    messagingSenderId: "947666434839", // CRÍTICO: Debe ser el correcto
    appId: "1:947666434839:web:8f6ba1701ac8128d1f9552",
};

const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Lógica para manejar la notificación en segundo plano/cerrada
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico' // Asegúrate de tener un ícono en la raíz pública
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});