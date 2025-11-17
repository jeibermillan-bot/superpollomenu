import React, { useState, createContext, useContext, useMemo, useEffect } from "react";
import { ShoppingBag, Menu as MenuIcon, Truck, CheckCircle, X, Loader2, Minus, Plus, Lock, Trash2, Edit, AlertTriangle, User } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, setLogLevel, orderBy } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import PaymentOptions from './components/PaymentOptions';
import SuperPolloLogo from "./assets/images/logosuperpollo.png";
import ImageZoomModal from "./components/ImageZoomModal";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Contexto para el estado global del menú y el carrito
const MenuContext = createContext();

// ----------------------------------------------------------------------
// Configuraciones y Constantes
// ----------------------------------------------------------------------

// 🚨🚨🚨 PASO 1: REEMPLAZA ESTOS VALORES CON TUS CLAVES REALES DE FIREBASE 🚨🚨🚨
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCAsTQl_uOZwupLwOJjBZZJKWkGd5YVhXs",
  authDomain: "mi-menu-app-9c084.firebaseapp.com",
  projectId: "mi-menu-app-9c084",
  storageBucket: "mi-menu-app-9c084.firebasestorage.app",
  messagingSenderId: "947666434839",
  appId: "1:947666434839:web:8f6ba1701ac8128d1f9552",
  measurementId: "G-B7HV822FGJ"
};
// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const analytics = getAnalytics(app);
// PIN de Administrador para la interfaz
const ADMIN_PIN = "1234"; 

export async function guardarResumenDiario(db, data) {
  try {
    await addDoc(collection(db, "resumenDiario"), data);
    return { ok: true };
  } catch (error) {
    console.error("Error guardando resumen: ", error);
    return { ok: false, error };
  }
}
// Constantes de la App
const PRIMARY_WHATSAPP = '573138715813'; 
const COPY_WHATSAPP = '573116341263'; 

// Define el ID de la app.
const appId = FIREBASE_CONFIG.projectId || 'default-app-id';

// Funciones Auxiliares
const formatPrice = (price) => `$${(price / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const getCollectionPath = (collectionName, userId, isPublic = true) => {
    // Esta es la ruta que DEBE coincidir con tu estructura en Firestore y tus reglas de seguridad.
    if (isPublic) {
        return `artifacts/${appId}/public/data/${collectionName}`;
    }
    return `artifacts/${appId}/users/${userId}/${collectionName}`;
};

// ----------------------------------------------------------------------
// Componente de Utilidad (Modal/Aviso)
// ----------------------------------------------------------------------

const Modal = ({ title, children, onClose, isOpen }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// PedidosProvider (Manejo del Estado Global y Firebase)
// ----------------------------------------------------------------------

const PedidosProvider = ({ children }) => {
    // ----------------------------------------------------------------------
    // ESTADOS (¡Todos juntos al inicio!)
    // ----------------------------------------------------------------------
    const [imageModalUrl, setImageModalUrl] = useState(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [error, setError] = useState(null);
    const [userId, setUserId] = useState(null);
    const [showModal, setShowModal] = useState(null); 
    const [pinInput, setPinInput] = useState('');
    const [isAdmin, setIsAdmin] = useState(false); 
    const [editingItem, setEditingItem] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [showCart, setShowCart] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [db, setDb] = useState(null); 
    const [appInstance, setAppInstance] = useState(null);
    
    
    // ----------------------------------------------------------------------
    // FUNCIONES DEL MODAL DE IMAGEN (¡Ahora fuera del useMemo!)
    // ----------------------------------------------------------------------
    const openImageModal = (url) => {
        setImageModalUrl(url);
        setIsImageModalOpen(true);
    };

    const closeImageModal = () => {
        setIsImageModalOpen(false);
        setImageModalUrl(null);
    };

    const updateItemOrderIndex = async (itemId, newIndex) => {

        console.log(`Update Check: isAdmin=${isAdmin}, db Loaded=${!!db}, itemId=${itemId}`);
    // Asegura que db está cargado Y que es Admin
    if (!isAdmin || !db) {
        console.error("Fallo de guardado: DB no cargada o no es Admin.");
        return;
    }

    try {
        // 🚨 USAR EL db DEL ESTADO 🚨
        const itemRef = doc(db, menuCollectionPath, itemId); 
        await updateDoc(itemRef, { orderIndex: newIndex }); 
        console.log(`ORDEN EXITOSA: Ítem ${itemId} actualizado a: ${newIndex}`); 
    } catch (e) {
        console.error("Error AL GUARDAR orderIndex en Firestore:", e);
    }
};
    // ----------------------------------------------------------------------


    const isOrderValid = useMemo(() => {
        // 1. Debe haber al menos 1 producto en el carrito
        const hasItems = cart.length > 0;
        
        // 🚨 CRÍTICO: Las funciones openImageModal y closeImageModal 
        // ¡DEBEN ser ELIMINADAS de aquí! Solo va la lógica de validación.
        
        // 2. Nombre y dirección deben tener al menos 3 caracteres
        const hasRequiredInfo = customerName.trim().length > 2 && customerAddress.trim().length > 2;
        
        // 3. Debe haber un método de pago seleccionado
        const hasPaymentMethod = paymentMethod !== null && paymentMethod !== '';
    return hasItems && hasRequiredInfo && hasPaymentMethod;

}, [cart, customerName, customerAddress, paymentMethod]);

    const menuCollectionPath = getCollectionPath('menuItems');

    // --- 1. CONFIGURACIÓN E INICIO DE SESIÓN FIREBASE ---
    useEffect(() => {
    setLogLevel('debug');
    
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "TU_API_KEY_DE_FIREBASE") {
        setError("Error: La configuración de Firebase no ha sido actualizada. ¡Revisa el paso 1!");
        setIsLoading(false);
        return;
    }

    let app, auth, firestoreDb;
    try {
        // Inicialización
        app = initializeApp(FIREBASE_CONFIG);
        auth = getAuth(app);
        firestoreDb = getFirestore(app); // 👈 Usaremos esta variable 'firestoreDb'
        setAppInstance(app);
        setDb(firestoreDb);
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
        setError("Error al inicializar Firebase. ¿Están todos los servicios habilitados?");
        setIsLoading(false);
        return;
    }

    let unsubscribeFirestore;
    
    // 1. Manejo de Autenticación
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);
            
            // 🚨 CAMBIO CRÍTICO: INICIAR EL LISTENER AQUÍ (dentro de la autenticación exitosa) 🚨
            try {
                const q = query(
                    collection(firestoreDb, menuCollectionPath), // Usamos firestoreDb
                    orderBy('orderIndex', 'asc') // 👈 La solución del orden
                );
                
                unsubscribeFirestore = onSnapshot(q, (snapshot) => {
                    const items = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            name: data.name || 'Sin nombre',
                            description: data.description || 'Sin descripción',
                            orderIndex: parseFloat(data.orderIndex) || 0,
                            price: typeof data.price === 'number' ? data.price : 0, // Convertir de centavos
                            imageUrl: data.imageUrl || `https://placehold.co/400x300/a855f7/ffffff?text=${encodeURIComponent(data.name || 'Producto')}`,
                        };
                    });
                    setMenuItems(items); 
                    setIsLoading(false); // Detener el loader una vez que los datos cargan
                }, (firestoreError) => {
                    console.error("Error en el listener de Firestore:", firestoreError);
                    setError("Error al leer la base de datos.");
                });

            } catch (e) {
                console.error("Error al configurar onSnapshot:", e);
                setError("Error fatal al intentar leer la base de datos.");
                setIsLoading(false);
            }
            // ----------------------------------------------------------------------------------

        } else {
            // Lógica para intentar iniciar sesión anónimamente
            try {
                if (typeof __initial_auth_token === 'undefined') {
                    await signInAnonymously(auth);
                } else {
                    await signInWithCustomToken(auth, __initial_auth_token);
                }
            } catch (anonError) {
                console.error("Error al iniciar sesión anónimamente:", anonError);
                setError("No se pudo iniciar sesión en Firebase.");
            }
            setIsAuthReady(true);
        }
    });

    return () => {
        unsubscribeAuth();
        // Asegurar que el listener de Firestore se limpia
        if (unsubscribeFirestore) { 
            unsubscribeFirestore();
        }
    };



    }, [isAuthReady]); 

    // --- 2. Lógica del Carrito ---

    const addToCart = (item, quantity = 1) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
            if (existingItem) {
                return prevCart.map(cartItem =>
                    cartItem.id === item.id
                        ? { ...cartItem, quantity: cartItem.quantity + quantity }
                        : cartItem
                );
            } else {
                return [...prevCart, { ...item, quantity }];
            }
        });
    };
    const updateQuantity = (itemId, newQuantity) => {
        if (newQuantity <= 0) {
            setCart(prevCart => prevCart.filter(item => item.id !== itemId));
        } else {
            setCart(prevCart => prevCart.map(item =>
                item.id === itemId ? { ...item, quantity: newQuantity } : item
            ));
        }
    };
    const clearCart = () => setCart([]);
    const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
    const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

    // --- 3. Lógica de Pedidos ---

    const generateOrderText = () => {
        if (cart.length === 0) return "";
        const itemsText = cart.map(item => `${item.quantity}x ${item.name} (${formatPrice(item.price)} c/u)`).join('\n');
        const totalText = `\nTotal: ${formatPrice(total)}`;
        const header = `¡Hola! Soy un cliente de la App de Menú. Me gustaría hacer un pedido:\n\n`;
        return header + itemsText + totalText;
    };

   // En tu archivo PedidosProvider.jsx

const sendOrder = async () => {

    console.log("Estado de la base de datos (DB):", db); 

// Si db es nulo/indefinido (aún no cargado), salimos de la función con un error.
if (!db) { 
    console.error("❌ ERROR CRÍTICO: La instancia de la base de datos (db) no está cargada.");
    return;
    }
    // 1. Verificar si el carrito está vacío
    if (cart.length === 0) return;

    // 2. Construir la lista de productos
    const productList = cart.map(item =>
        `* ${item.quantity}x ${item.name} (${formatPrice(item.price * item.quantity)})`
    ).join('\n');

    // 3. Determinar el texto del método de pago (usa la variable del Contexto)
    let paymentText = 'Efectivo'; // Valor por defecto

    if (paymentMethod === 'nequi') {
        paymentText = 'Transferencia Nequi';
    } else if (paymentMethod === 'daviplata') {
        paymentText = 'Transferencia DaviPlata';
    } else if (paymentMethod === 'efectivo') {
        paymentText = 'Efectivo (Pago al recoger)';
    } else if (paymentMethod === 'contra_entrega') {
        paymentText = 'Efectivo (Pago contra entrega)';
    }

    // 4. Ensamblar el mensaje final completo (usado para WhatsApp y el portapapeles)
    // En tu archivo PedidosProvider.jsx, dentro de la función sendOrder

const finalMessageText = 
    `👋 ¡Hola! Me gustaría realizar este pedido:\n\n` +
    `--- DATOS DEL CLIENTE ---\n` +
    // --- ¡AÑADE ESTAS LÍNEAS! ---
    `👤 *Nombre:* ${customerName}\n` +
    `📍 *Dirección:* ${customerAddress}\n` +
    // Solo incluye las notas si el cliente escribió algo
    (orderNotes ? `📝 *Notas:* ${orderNotes}\n` : '') + 
    `--- Resumen del Pedido ---\n` +
    // ----------------------------
    `${productList}\n\n` +
    `💰 *Método de Pago:* ${paymentText}\n` + 
    `💵 *Total a Pagar:* ${formatPrice(total)}`;

    
    if (cart.length === 0) return;

const orderData = {
    customerName: customerName,
    customerAddress: customerAddress,
    orderNotes: orderNotes,
    total: total,
    paymentMethod: paymentMethod,
    // CRÍTICO: Registramos la fecha y hora de la orden
    timestamp: new Date().toISOString(), 
    
    // Guardamos los productos del carrito de forma clara
    items: cart.map(item => ({ 
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
    })),
    status: 'Enviado a WhatsApp', // Un estado inicial
};

// --- 2. Guardar en Firestore ---
try {
    const ordersCollectionRef = collection(db, "orders");
    const docRef = await addDoc(ordersCollectionRef, orderData);
    console.log("✔️ Pedido registrado con ID: ", docRef.id);
} catch (e) {
    console.error("❌ Error al registrar el pedido en Firestore: ", e);
}
    
// 5. Enviar el pedido por WhatsApp
const phoneNumber = "3116341263"; // <--- ¡Tu número de WhatsApp!
const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(finalMessageText)}`;

window.open(whatsappUrl, '_blank');

// 6. Copiar el mensaje al portapapeles y acciones finales
const textarea = document.createElement('textarea'); // <-- ¡Solo una declaración!
textarea.value = finalMessageText; 
document.body.appendChild(textarea);
textarea.select();
try {
    document.execCommand('copy');
} catch (err) {
    console.error('Error al copiar al portapapeles:', err);
}
document.body.removeChild(textarea);

// 7. Mostrar el Modal de confirmación y vaciar el carrito
setShowModal('orderSent');
clearCart();

setCustomerName('');
setCustomerAddress('');
setOrderNotes('');
// La función sendOrder termina aquí
};
    
    // --- 4. Lógica del Administrador (PIN) ---

    const handlePinSubmit = (pin) => {
        if (pin === ADMIN_PIN) {
            setIsAdmin(true);
            setShowModal(null);
            setPinInput('');
        } else {
            alert("PIN incorrecto. Inténtalo de nuevo."); 
            setPinInput('');
        }
    };

    const promptAdminPin = () => { setShowModal('pin'); };
    
    const toggleAdminMode = () => {
        if(isAdmin) {
            setIsAdmin(false);
        } else {
            promptAdminPin();
        }
    };

    // --- 5. Lógica CRUD de Firestore (Admin) ---
    
    const saveItem = async (item) => {
    if (!isAdmin) return;
    const db = getFirestore(initializeApp(FIREBASE_CONFIG));
    
    try {
        // 🚨 1. CORRECCIÓN CRÍTICA PARA EL PRECIO 🚨
        // Convierte a string, elimina puntos/comas (separadores de miles).
        const priceString = item.price.toString().replace(/[.,]/g, '');
        
        // Convierte el valor limpio a número entero.
        const finalPriceNumber = parseInt(priceString, 10);
        
        // Multiplica por 100. (Ej: 50000 * 100 = 5000000)
        const itemPriceInCents = Math.round(finalPriceNumber * 100); 
        // -----------------------------------------------------------------
        
        let itemData = {
            name: item.name,
            description: item.description,
            price: itemPriceInCents, // ¡Ahora es el valor correcto!
            imageUrl: item.imageUrl,
        };

        if (item.id) {
            // --- EDICIÓN ---
            const itemRef = doc(db, menuCollectionPath, item.id);
            // No se necesita el orderIndex, solo actualiza otros campos
            await updateDoc(itemRef, itemData);
        } else {
            // --- CREACIÓN ---
            console.log("Número de ítems para calcular índice:", menuItems.length);
            console.log("Lista de ítems:", menuItems);
            // 🚨 1. Calcular el índice más alto de la lista actual (CRÍTICO) 🚨
            const maxOrderIndex = menuItems.reduce( 
                (max, current) => (current.orderIndex > max ? current.orderIndex : max), 
                0 // Inicia en 0
            );
            const newOrderIndex = maxOrderIndex + 1;
            
            // 🚨 2. Añadir el campo orderIndex al objeto de datos 🚨
            itemData.orderIndex = newOrderIndex; 

            await addDoc(collection(db, menuCollectionPath), itemData);
        }
        
        setShowModal(null); 
        setEditingItem(null);
    } catch (e) {
        console.error("Error al guardar ítem:", e);
        // Puedes añadir un setError aquí para mostrar el error al usuario.
    }
};  

    const deleteItem = async (itemId) => {
        if (!isAdmin) return;
        const confirmDelete = window.confirm("¿Estás seguro de que quieres eliminar este producto?");

        if (confirmDelete) {
            const db = getFirestore(initializeApp(FIREBASE_CONFIG));
            try {
                await deleteDoc(doc(db, menuCollectionPath, itemId));
            } catch (e) {
                console.error("Error al eliminar ítem:", e);
            }
        }
    };

    const startEdit = (item) => {
        if (!isAdmin) { promptAdminPin(); return; }
        setEditingItem({ ...item, price: (item.price / 100).toFixed(2) }); 
        setShowModal('edit');
    };

    const startCreate = () => {
        if (!isAdmin) { promptAdminPin(); return; }
        setEditingItem({ name: '', description: '', price: '0.00', imageUrl: '', id: null });
        setShowModal('edit');
    };

    // En tu archivo de Contexto (donde está PedidosProvider)

const contextValue = useMemo(() => ({
    // Datos y Estado
    menuItems, cart, total, totalItems, 
    isLoading, error, userId, openImageModal, imageModalUrl, isImageModalOpen, closeImageModal, 
    
    // --- NUEVOS ESTADOS EN EL CONTEXTO ---
    customerName, setCustomerName,
    customerAddress, setCustomerAddress,
    orderNotes, setOrderNotes, isOrderValid, 
    // ------------------------------------

    // Variables de Pago y Carrito
    paymentMethod, 
    setPaymentMethod,
    showCart, 
    setShowCart,
    
    // Funciones Principales
    addToCart, updateQuantity, clearCart, 
    sendOrder, formatPrice,
    
    // Admin
    isAdmin, toggleAdminMode, 
    deleteItem, startEdit, startCreate, updateItemOrderIndex,
    
}), [
    // --- ¡LISTA DE DEPENDENCIAS CORREGIDA Y COMPLETA! ---
    menuItems, cart, total, totalItems, 
    isLoading, error, userId, isAdmin, updateItemOrderIndex, addToCart, updateQuantity,
    clearCart, sendOrder,
    
    // CRÍTICO: Los ESTADOS para los campos deben estar aquí.
    customerName,
    customerAddress,
    orderNotes, isOrderValid,
    
    // CRÍTICO: Los SETTERS para los campos DEBEN estar aquí.
    setCustomerName,
    setCustomerAddress,
    setOrderNotes,
    
    // Variables de Pago y Carrito
    paymentMethod, 
    showCart,
    setShowCart, 
    setPaymentMethod,
    openImageModal, closeImageModal, imageModalUrl, isImageModalOpen,
    addToCart, 
    updateQuantity, 
    clearCart, 
    sendOrder,
    
    // Las funciones que NO usan useCallback (y por lo tanto cambian en cada render):
    // Si addToCart, updateQuantity, clearCart, sendOrder NO usan useCallback,
    // también deben estar listadas. Si sí lo usan, no hace falta.
]);

    return (
        <MenuContext.Provider value={contextValue}>
            {children}
            
            {/* Modal de Ingreso de PIN */}
            <Modal title="Acceso de Administrador" isOpen={showModal === 'pin'} onClose={() => setShowModal(null)}>
                <p className="text-gray-600 mb-4">Ingresa el PIN para desbloquear las funciones de edición.</p>
                <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-lg text-center"
                    placeholder="PIN"
                    maxLength={4}
                />
                <button
                    onClick={() => handlePinSubmit(pinInput)}
                    className="mt-4 w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition"
                >
                    Desbloquear
                </button>
                <p className="text-xs text-center text-gray-400 mt-2">PIN por defecto: {ADMIN_PIN}</p>
            </Modal>
            
            {/* Modal de Edición/Creación de Ítem */}
            <ItemEditModal 
                isOpen={showModal === 'edit'} 
                onClose={() => {setShowModal(null); setEditingItem(null);}} 
                item={editingItem} 
                saveItem={saveItem}
            />
            
            {/* Modal de Orden Enviada */}
            <Modal title="¡Pedido Enviado y Copiado!" isOpen={showModal === 'orderSent'} onClose={() => setShowModal(null)}>
                <div className="text-center">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                    <p className="text-lg text-gray-700 font-semibold mb-2">Tu pedido ha sido enviado a WhatsApp.</p>
                    <p className="text-sm text-gray-500">
                        Además, el resumen del pedido se copió al portapapeles.
                    </p>
                    <p className="text-xs text-gray-400 mt-3">
                        Si hay algún problema, puedes contactar al número de copia: {COPY_WHATSAPP}
                    </p>
                </div>
            </Modal>
            {isImageModalOpen && (
                <ImageZoomModal 
                    imageUrl={imageModalUrl} 
                    onClose={closeImageModal} 
                />
            )}
        </MenuContext.Provider>
    );
};

// ----------------------------------------------------------------------
// Modal de Edición de Ítem (Admin)
// ----------------------------------------------------------------------

const ItemEditModal = ({ isOpen, onClose, item, saveItem }) => {
    
    // Objeto base para garantizar que todas las llaves existan, especialmente imageUrl.
    const baseItem = { name: '', description: '', price: '0.00', imageUrl: '' }; 

    // Inicializa el estado fusionando las propiedades base con el ítem actual.
    // Esto asegura que 'imageUrl' siempre esté presente.
    const [formData, setFormData] = useState({ ...baseItem, ...item });

    useEffect(() => {
        if (item) {
            // Al cambiar el ítem (ej: al hacer clic en 'Editar'), fusiona el ítem de Firestore con baseItem.
            setFormData({ ...baseItem, ...item });
        } else {
            // Si es un ítem nuevo
            setFormData(baseItem);
        }
    }, [item]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'price') {
            const numValue = value.replace(/[^0-9.]/g, ''); 
            if (numValue.split('.').length > 2) return; 
            setFormData(prev => ({ ...prev, [name]: numValue }));
        } else {
            // Esto captura correctamente la URL de la imagen
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isNaN(parseFloat(formData.price))) {
            alert("Por favor, introduce un precio numérico válido.");
            return;
        }
        // saveItem recibe el formData completo, incluyendo la URL
        saveItem(formData);
        onClose(); // Cierra el modal después de guardar
    };

    if (!isOpen) return null; // Si el modal no está abierto, no renderizar nada

    return (
        // Asegúrate de que este componente 'Modal' esté disponible o usa un div simple si es necesario
        <Modal title={item && item.id ? "Editar Producto" : "Crear Producto"} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Campo Nombre */}
                <div><label className="block text-sm font-medium text-gray-700">Nombre</label><input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/></div>
                
                {/* Campo Descripción */}
                <div><label className="block text-sm font-medium text-gray-700">Descripción</label><textarea name="description" value={formData.description || ''} onChange={handleChange} rows="3" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/></div>
                
                {/* Campo Precio */}
                <div><label className="block text-sm font-medium text-gray-700">Precio (en formato 00.00)</label><input type="text" name="price" value={formData.price || ''} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Ej: 85.00"/></div>
                
                {/* Campo URL de Imagen (El campo clave) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">URL de Imagen</label>
                    <input 
                        type="url" 
                        name="imageUrl" 
                        value={formData.imageUrl || ''} // Usar || '' para evitar errores si es null
                        onChange={handleChange} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" 
                        placeholder="https://ejemplo.com/imagen.jpg (Opcional)"
                    />
                </div>
                
                {/* Botones de Acción */}
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition">proceder</button>
                </div>
            </form>
        </Modal>
    );
};

// ----------------------------------------------------------------------
// Componentes de Interfaz
// ----------------------------------------------------------------------

const Header = () => {
    const { 
        totalItems, total, isAdmin, toggleAdminMode, startCreate, userId, 
        showCart, setShowCart, paymentMethod, setPaymentMethod, 
        cart, updateQuantity, formatPrice, sendOrder, clearCart, 
        
        // --- ¡NUEVAS PROPS AÑADIDAS! ---
        customerName, setCustomerName,
        customerAddress, setCustomerAddress,
        orderNotes, setOrderNotes,
        // -------------------------------
        
    } = useContext(MenuContext);
    
    return (
        <header className="sticky top-0 z-40 bg-black shadow-lg">
            <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
                
                <h1 className="text-4xl font-Bebas Neue text-gray-200 tracking-tight"style={{ textShadow: '4px 4px 12px yellow' }}>😁 MENÚ SUPER POLLO 📱</h1>
                
                <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-400 truncate max-w-[80px] sm:max-w-none" title={`UserID: ${userId}`}>
                        <User size={12} className="inline-block mr-1" />{userId ? userId.substring(0, 8) + '...' : 'Cargando...'}
                    </span>
                    <button onClick={toggleAdminMode} title={isAdmin ? "Salir de Modo Admin" : "Entrar en Modo Admin"} className={`p-3 rounded-full transition duration-300 ${isAdmin ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                        <Lock size={20} className={isAdmin ? 'rotate-0' : 'rotate-180'} />
                    </button>
                    <button onClick={() => setShowCart(true)} className="p-3 bg-purple-600 text-white rounded-full shadow-md hover:bg-purple-700 transition relative">
                        <ShoppingBag size={24} />
                        {totalItems > 0 && (<span className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 bg-red-500 text-xs text-white rounded-full h-5 w-5 flex items-center justify-center font-bold">{totalItems}</span>)}
                    </button>
                </div>
            </div>
            
            {/* Llamada a CartDropdown con todas las nuevas props */}
            <CartDropdown 
                isOpen={showCart} total={total} onClose={() => setShowCart(false)} 
                cart={cart} updateQuantity={updateQuantity}
                formatPrice={formatPrice} sendOrder={sendOrder} clearCart={clearCart}
                paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                
                // --- ¡NUEVAS PROPS PASADAS! ---
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerAddress={customerAddress}
                setCustomerAddress={setCustomerAddress}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                // -----------------------------
            />
            
            {isAdmin && (
                 <div className="bg-yellow-100 border-t border-yellow-300 p-2 text-center text-sm font-semibold flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
                     <div className="flex items-center space-x-2"><AlertTriangle size={18} className="text-yellow-600"/><span className="text-yellow-800">MODO ADMINISTRADOR ACTIVO</span></div>
                     <button onClick={startCreate} className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-md hover:bg-green-600 transition">+ Nuevo Producto</button>
                 </div>
            )}
        </header>
    );
};

// Importaciones necesarias (Si no están al inicio del archivo)
// import { X, Minus, Plus, Truck, ShoppingBag, CheckCircle } from 'lucide-react'; 
// import PaymentOptions from './PaymentOptions'; // Si PaymentOptions está en un archivo separado

const CartDropdown = ({ 
    isOpen, total, onClose, cart, updateQuantity, formatPrice, sendOrder, clearCart, 
    paymentMethod, setPaymentMethod, 
    
    // --- ¡NUEVAS PROPS RECIBIDAS! ---
    customerName, setCustomerName,
    customerAddress, setCustomerAddress,
    orderNotes, setOrderNotes
    // --------------------------------
}) => {
    
    if (!isOpen) return null;

    return (
        <div className="fixed top-0 right-0 h-full w-5/6 md:w-100 bg-white shadow-2xl z-40 transition-transform duration-300 transform translate-x-0">
            
            {/* Encabezado del carrito */}
            <div className="p-5 border-b flex justify-between items-center bg-red-600 text-white">
                <h2 className="text-xl font-bold">¡Arma tu Combo! 💪</h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-purple-700 transition">
                    <X size={24} />
                </button>
            </div>

            {/* Contenido del carrito: Lista de ítems, Pago y Total */}
            <div className="p-4 overflow-y-auto h-[calc(100%-190px)]"> 
                
                {cart.length === 0 ? (
                    <p className="text-center text-gray-500 mt-10">Esperando tu pedido, no te arrepentiras¡😉😊</p>
                ) : (
                    <div className="space-y-4">
                        
                        {/* Mapeo de Productos */}
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center border-b pb-3">
                                {/* ... Código de los ítems del carrito ... */}
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                                    <p className="text-purple-600 text-sm font-bold">{formatPrice(item.price)}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 bg-gray-400 rounded-full hover:bg-gray-300 transition"><Minus size={16} /></button>
                                    <span className="font-bold w-4 text-center text-gray-800">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 bg-gray-400 rounded-full hover:bg-gray-300 transition"><Plus size={16} /></button>

                                </div>
                            </div>
                        ))} 
                        
                        {/* --- ¡NUEVO FORMULARIO DE CONTACTO AÑADIDO! --- */}
                        <div className="space-y-3 pt-4 border-t border-gray-200"> 
                            <h3 className="font-bold text-md text-gray-700">👤 Datos de Contacto y Entrega:</h3>
                            
                            {/* Campo Nombre */}
                            <input
                                type="text"
                                placeholder="Tu Nombre"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800" // ¡AÑADIDO text-gray-800!"
                            />
                            
                            {/* Campo Dirección */}
                            <input
                                type="text"
                                placeholder="Dirección de Entrega"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                            />
                            
                            {/* Campo Observaciones */}
                            <textarea
                                placeholder="Observaciones (Ej: Sin salsas, timbre 3, etc.)"
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                rows="2"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-gray-800"
                            />
                        </div>
                        {/* ----------------------------------------------- */}
                        
                        {/* Opciones de Pago */}
                        <PaymentOptions
                            selectedMethod={paymentMethod}
                            setPaymentMethod={setPaymentMethod}
                            totalAmount={formatPrice(total)}
                        />
                        
                        {/* Resumen de Total */}
                        <div className="mt-4 border-t pt-3">
                            <div className="flex justify-between items-center font-bold text-lg text-gray-800 mb-4">
                                <span>Total:</span>
                                <span className="text-red-700">{formatPrice(total)}</span>
                            </div>
                        </div>

                    </div>
                )} 
            </div>

            {/* Botones de Acción */}
            <div className="p-4 border-t absolute bottom-0 w-full bg-white">
                <button onClick={sendOrder} className="w-full flex items-center justify-center bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-green-600 transition">
                    <Truck size={20} className="mr-2" />Enviar Pedido por WhatsApp
                </button>
                <button onClick={clearCart} className="w-full text-center text-sm text-gray-500 mt-2 hover:text-red-500 transition">Eliminar Pedido 🙎😞</button>
            </div>
        </div>
    );
};

export const MenuItemCard = ({ item }) => {
    
    // Desestructuración de Contexto
    // CRÍTICO: Añadimos 'openImageModal' aquí
    const { addToCart, formatPrice, isAdmin, deleteItem, startEdit, openImageModal, cart } = useContext(MenuContext);
    
    const estaSeleccionado = cart.some(
    // Verifica si el ID del ítem actual (item.id) está en la lista del carrito
    (itemCarrito) => itemCarrito.id === item.id
);
    const itemEnCarrito = cart.find((cartItem) => cartItem.id === item.id);
    const cantidadActual = itemEnCarrito ? itemEnCarrito.quantity : 0;

    // Función para añadir al carrito
    const handleAddToCart = () => { addToCart(item); };

    // FUNCIÓN NUEVA: Manejador para abrir el modal de imagen
    const handleImageClick = (e) => {
        // Detiene el evento para que no interfiera con otros elementos (aunque aquí es el padre)
        e.stopPropagation(); 
        if (item.imageUrl && openImageModal) {
            openImageModal(item.imageUrl);
        }
    };
      console.log("ITEM COMPLETO:", item);
    console.log("URL DE LA MINIATURA:", item.imageUrl);

    return (
        // 🎯 Contenedor Principal con CLASES CONDICIONALES 🎯
        <div 
            // Utilizamos template literals (comillas invertidas) para la lógica condicional
            className={`
                bg-gray-300 
                rounded-xl 
                shadow-lg 
                overflow-hidden 
                flex 
                flex-col 
                sm:flex-row 
                sm:items-stretch 
                transition-all 
                duration-300 
                hover:shadow-xl
                relative 
                
                ${estaSeleccionado 
                    ? 'ring-4 ring-red-500 border-2 border-green-700' // CLASES AL ESTAR ELEGIDO
                    : '' // Clases si no está seleccionado
                }
            `}
        >
            {/* 🟢 Ícono de confirmación (Se muestra solo si estáSeleccionado es true) */}
            {estaSeleccionado && (
                <div className="absolute top-2 left-2 bg-green-700 text-white rounded-full px-2 py-1 text-xs font-bold z-20">
                    ✔ ELEGIDO
                </div>
            )}
            
            {/* 1. SECCIÓN DE IMAGEN Y ADMIN (1/3 del ancho) */}
            <div 
                className="sm:w-1/3 w-full h-40 flex-shrink-0 relative"
            >
                
                {/* Contenedor de la Imagen con el evento de click */}
                {item.imageUrl && (
                    <div 
                        className="w-full h-40 relative group overflow-hidden" 
                        onClick={handleImageClick} 
                    >
                        {/* Etiqueta IMG */}
                        <img 
                            src={item.imageUrl} 
                            alt={item.name} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            onError={(e) => { 
                                e.target.onerror = null; 
                                e.target.src = `https://placehold.co/400x300/a855f7/ffffff?text=${encodeURIComponent(item.name || 'Producto')}` 
                            }}
                        />
                    </div>
                )}
                
                {/* Botones de Admin (Superpuestos) */}
                {isAdmin && (
                    <div className="absolute top-2 right-2 flex space-x-2 z-10">
                        <button 
                            onClick={(e) => {e.stopPropagation(); startEdit(item);}} 
                            className="p-2 bg-yellow-400 text-white rounded-full shadow-lg hover:bg-yellow-500 transition" 
                            title="Editar"
                        ><Edit size={16} /></button>
                        <button 
                            onClick={(e) => {e.stopPropagation(); deleteItem(item.id);}} 
                            className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition" 
                            title="Eliminar"
                        ><Trash2 size={16} /></button>
                    </div>
                )}
            </div>

            {/* 2. SECCIÓN DE DETALLES Y ACCIÓN (2/3 del ancho) */}
            <div className="sm:w-5/6 flex-1 p-4 sm:p-5 flex flex-col justify-between">
                
                {/* Detalles del Producto: Nombre y Descripción */}
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-1">{item.name}</h2>
                    <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                </div>

                {/* Precio y Botón de Añadir */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-auto">
                    <span className="text-2xl font-extrabold text-purple-700">{formatPrice(item.price)}</span>
                    <button 
                        onClick={handleAddToCart} 
                        className="flex items-center bg-green-500 text-white font-semibold py-2 px-4 rounded-full shadow-md hover:bg-green-600 transition transform hover:scale-105 active:scale-95"
                    >
                        <Plus size={18} className="mr-1" />
                        Añadir
                    </button>
                </div>
            </div>
        </div>
    );
};

// Recuerda agregar 'export default MenuItemCard;' al final del archivo si no lo has hecho.

const MenuList = () => {
    const { menuItems, isLoading, error, isAdmin, updateItemOrderIndex } = useContext(MenuContext);

    // MenuList.jsx (después de obtener las variables del contexto)

    const handleDragEnd = (result) => {
        if (!result.destination || result.source.index === result.destination.index) return; 

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;
        
        const newItems = Array.from(menuItems);
        const [reorderedItem] = newItems.splice(sourceIndex, 1);
        newItems.splice(destinationIndex, 0, reorderedItem);

        let newOrderIndex;
        const prevItem = newItems[destinationIndex - 1];
        const nextItem = newItems[destinationIndex + 1];

        if (!prevItem) {
            newOrderIndex = nextItem.orderIndex / 2;
        } else if (!nextItem) {
            newOrderIndex = prevItem.orderIndex + 1;
        } else {
            newOrderIndex = (prevItem.orderIndex + nextItem.orderIndex) / 2;
        }
        
        // 🚨 Llamada a la función del contexto 🚨
        updateItemOrderIndex(reorderedItem.id, newOrderIndex);
    };
    
    // ...

    if (isLoading) {
        return <div className="text-center p-8">Cargando menú...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-red-600">Error: {error}</div>;
    }
    
    // --- Renderizado de Lista ---

    // Si el usuario NO es Admin, mostramos la lista normal y estática.
    if (!isAdmin) {
        return (
            <div className="max-w-5xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {menuItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} />
                ))}
            </div>
        );
    }
        
    // Si el usuario SÍ es Admin, usamos la estructura DND.
    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="menu-list-id">
                {(provided) => (
                    <div 
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="max-w-5xl mx-auto p-4 grid grid-cols-1 md:grid-cols-1 gap-4" 
                    >
                        {menuItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps} 
                                        className={`
                                            transition-shadow duration-200 
                                            ${snapshot.isDragging ? 'shadow-2xl ring-4 ring-purple-500 bg-white' : 'shadow-md'}
                                            rounded-lg
                                        `}
                                    >
                                        <MenuItemCard item={item} />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder} 
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
};


// ----------------------------------------------------------------------
// Componente Principal
// ----------------------------------------------------------------------

export default function App() {
    return (
        <PedidosProvider>
            <div className="min-h-screen text-white bg-gray-600 font-[Inter]">
                <p className="text-xl font-medium">¡Bienvenido! Estamos tomando pedidos hasta las 9 PM.</p>
    
   
                <style jsx global>{`
                    body {
                        font-family: 'Inter', sans-serif;
                    }
                `}</style>
                <Header />
                <MenuList />
            </div>
        </PedidosProvider>
    );
}