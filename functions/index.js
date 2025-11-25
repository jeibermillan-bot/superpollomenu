const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

// Inicialización de Admin SDK
initializeApp();

// Canal EXACTO usado en Android
const ALARM_CHANNEL_ID = 'pedidos_urgentes';

// UID donde tu app Android guarda SIEMPRE el token
const ADMIN_UID = 'superAdmin01';

exports.notificarNuevoPedido = onDocumentCreated('orders/{orderId}', async (event) => {
    if (!event.data) return null;

    const pedido = event.data.data();
    const { customerName, total, items } = pedido;

    const db = getFirestore();
    const adminSnap = await db.collection('administradores').doc(ADMIN_UID).get();

    if (!adminSnap.exists) {
        console.log("⚠ El documento del admin NO existe.");
        return null;
    }

    const fcmToken = adminSnap.data().fcmToken;

    if (!fcmToken) {
        console.log("⚠ No existe token FCM guardado.");
        return null;
    }

    console.log(`📡 Enviando notificación al token: ${fcmToken.substring(0, 12)}...`);

    const totalFormateado = (total / 100).toFixed(2);

    const title = `🚨 NUEVO PEDIDO DE ${customerName}`;
    const body = `Total: $${totalFormateado} - Items: ${items.length}`;

    // MENSAJE FINAL A FIREBASE
    const message = {
        token: fcmToken,

        data: {
            type: 'new_order',
            orderId: event.params.orderId,
            title: title,
            body: body,
            channel_id: ALARM_CHANNEL_ID
        },

        android: {
            priority: "HIGH",
            notification: {
                channel_id: ALARM_CHANNEL_ID,
                title: title,
                body: body,
                // TAG evita que las notificaciones se agrupen
                tag: "pedido_" + event.params.orderId
            }
        }
    };

    try {
        const resp = await getMessaging().send(message);
        console.log("✔ Notificación enviada:", resp);
    } catch (err) {
        console.error("❌ Error enviando notificación:", err);
    }

    return null;
});
