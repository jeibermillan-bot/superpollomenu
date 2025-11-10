import React, { useState, createContext, useContext, useMemo, useEffect } from "react";
import { ShoppingBag, Menu as MenuIcon, Truck, CheckCircle, X, Loader2, Minus, Plus, Lock, Trash2, Edit, AlertTriangle, User } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, setLogLevel } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import PaymentOptions from './components/PaymentOptions';

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

    const menuCollectionPath = getCollectionPath('menuItems');

    // --- 1. CONFIGURACIÓN E INICIO DE SESIÓN FIREBASE ---
    useEffect(() => {
        setLogLevel('debug');
        
        if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "TU_API_KEY_DE_FIREBASE") {
            setError("Error: La configuración de Firebase no ha sido actualizada. ¡Revisa el paso 1!");
            setIsLoading(false);
            return;
        }

        let app, auth, db;
        try {
            app = initializeApp(FIREBASE_CONFIG);
            auth = getAuth(app);
            db = getFirestore(app);
        } catch (e) {
            console.error("Firebase Initialization Failed:", e);
            setError("Error al inicializar Firebase. ¿Están todos los servicios habilitados (Auth Anónima y Firestore)?");
            setIsLoading(false);
            return;
        }

        // 1. Manejo de Autenticación
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    // Intenta el login anónimo para que todos los clientes puedan acceder.
                    if (typeof __initial_auth_token === 'undefined') {
                        await signInAnonymously(auth);
                    } else {
                         await signInWithCustomToken(auth, __initial_auth_token);
                    }
                } catch (anonError) {
                    console.error("Error al iniciar sesión anónimamente:", anonError);
                    setError("No se pudo iniciar sesión en Firebase. Revisa si la autenticación anónima está habilitada.");
                }
                 setIsAuthReady(true);
            }
        });

        // 2. Suscripción a Firestore (Menú)
        let unsubscribeFirestore;

        if (isAuthReady) {
            try {
                const q = query(collection(db, menuCollectionPath));
                
                unsubscribeFirestore = onSnapshot(q, (snapshot) => {
                    const items = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        items.push({ 
                            id: doc.id, 
                            ...data,
                            price: typeof data.price === 'number' ? data.price : 0,
                            imageUrl: data.imageUrl || `https://placehold.co/400x300/a855f7/ffffff?text=${encodeURIComponent(data.name || 'Producto')}`
                        });
                    });
                    setMenuItems(items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))); 
                    setIsLoading(false);
                }, (firestoreError) => {
                    console.error("Error al suscribirse a Firestore:", firestoreError);
                    setError("Error al cargar datos del menú. Revisa las reglas de seguridad de Firestore (Paso 2).");
                    setIsLoading(false);
                });

            } catch (e) {
                console.error("Error al configurar onSnapshot:", e);
                setError("Error fatal al intentar leer la base de datos.");
                setIsLoading(false);
            }
        }

        return () => {
            unsubscribeAuth();
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

const sendOrder = () => {
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
    `--- Resumen del Pedido ---\n` +
    `${productList}\n\n` +
    `💰 *Método de Pago:* ${paymentText}\n` + 
    `💵 *Total a Pagar:* ${formatPrice(total)}`;
    
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
            const itemPriceInCents = Math.round(parseFloat(item.price) * 100);
            const itemData = {
                name: item.name,
                description: item.description,
                price: itemPriceInCents, 
                imageUrl: item.imageUrl,
            };

            if (item.id) {
                const itemRef = doc(db, menuCollectionPath, item.id);
                await updateDoc(itemRef, itemData);
            } else {
                await addDoc(collection(db, menuCollectionPath), itemData);
            }
            setShowModal(null); 
            setEditingItem(null);
        } catch (e) {
            console.error("Error al guardar ítem:", e);
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
    isLoading, error, userId,

    // Variables de Pago y Carrito (¡NUEVAS!)
    paymentMethod, 
    setPaymentMethod,
    showCart, 
    setShowCart,
    
    // Funciones Principales
    addToCart, updateQuantity, clearCart, 
    sendOrder, formatPrice,
    
    // Admin
    isAdmin, toggleAdminMode, 
    deleteItem, startEdit, startCreate
    
}), [
    // --- LISTA DE DEPENDENCIAS CORREGIDA Y COMPLETA ---
    menuItems, cart, total, totalItems, 
    isLoading, error, userId, isAdmin,
    
    // ¡CRÍTICO! Variables de Pago y Carrito que DEBEN estar en useMemo
    paymentMethod, 
    showCart,
    setShowCart, // Los setters también deben ir para evitar errores
    setPaymentMethod,
    // ----------------------------------------------------
    
    // Nota: Las funciones (sendOrder, formatPrice, etc.) DEBEN estar en la lista 
    // si no son declaradas con useCallback. Si son declaradas con useCallback o
    // están definidas dentro de useMemo, no necesitan listarse.
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
        </MenuContext.Provider>
    );
};

// ----------------------------------------------------------------------
// Modal de Edición de Ítem (Admin)
// ----------------------------------------------------------------------

const ItemEditModal = ({ isOpen, onClose, item, saveItem }) => {
    const [formData, setFormData] = useState(item || { name: '', description: '', price: '0.00', imageUrl: '' });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'price') {
            const numValue = value.replace(/[^0-9.]/g, ''); 
            if (numValue.split('.').length > 2) return; 
            setFormData(prev => ({ ...prev, [name]: numValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isNaN(parseFloat(formData.price))) {
             alert("Por favor, introduce un precio numérico válido.");
             return;
        }
        saveItem(formData);
    };

    if (!item) return null;

    return (
        <Modal title={item.id ? "Editar Producto" : "Crear Producto"} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700">Nombre</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/></div>
                <div><label className="block text-sm font-medium text-gray-700">Descripción</label><textarea name="description" value={formData.description} onChange={handleChange} rows="3" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/></div>
                <div><label className="block text-sm font-medium text-gray-700">Precio (en formato 00.00)</label><input type="text" name="price" value={formData.price} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Ej: 85.00"/></div>
                <div><label className="block text-sm font-medium text-gray-700">URL de Imagen</label><input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="https://ejemplo.com/imagen.jpg (Opcional)"/></div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition">Guardar</button>
                </div>
            </form>
        </Modal>
    );
};

// ----------------------------------------------------------------------
// Componentes de Interfaz
// ----------------------------------------------------------------------

const Header = () => {
    const { totalItems, total, isAdmin, toggleAdminMode, startCreate, userId, showCart, setShowCart, 
           paymentMethod, setPaymentMethod, cart,  updateQuantity,  formatPrice,sendOrder, clearCart, } = useContext(MenuContext);
    

    return (
        <header className="sticky top-0 z-40 bg-white shadow-lg">
            <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
                <h1 className="text-3xl font-extrabold text-red-700 tracking-tight">ASADERO SUPER POLLO 📱</h1>
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
            <CartDropdown isOpen={showCart} total={total} onClose={() => setShowCart(false)} cart={cart} updateQuantity={updateQuantity}
                        formatPrice={formatPrice} sendOrder={sendOrder} clearCart={clearCart}
                          paymentMethod={paymentMethod}
                          setPaymentMethod={setPaymentMethod}
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

const CartDropdown = ({ isOpen, total, onClose, cart, updateQuantity, formatPrice, sendOrder, clearCart, paymentMethod, setPaymentMethod }) => {
    
    if (!isOpen) return null;

    return (
        // Contenedor Principal del Carrito (Se desliza)
        <div className="fixed top-0 right-0 h-full w-5/6 md:w-80 bg-white shadow-2xl z-40 transition-transform duration-300 transform translate-x-0">
            
            {/* Encabezado del carrito */}
            <div className="p-5 border-b flex justify-between items-center bg-purple-600 text-white">
                <h2 className="text-xl font-bold">Tu Pedido</h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-purple-700 transition">
                    <X size={24} />
                </button>
            </div>

            {/* Contenido del carrito: Lista de ítems, Pago y Total */}
            <div className="p-4 overflow-y-auto h-[calc(100%-190px)]"> 
                
                {cart.length === 0 ? (
                    // Estado de carrito vacío
                    <p className="text-center text-gray-500 mt-10">Tu carrito está vacío.</p>
                ) : (
                    <div className="space-y-4">
                        
                        {/* Mapeo de Productos */}
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center border-b pb-3">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                                    <p className="text-purple-600 text-sm font-bold">{formatPrice(item.price)}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 bg-gray-200 rounded-full hover:bg-gray-300 transition"><Minus size={16} /></button>
                                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 bg-gray-200 rounded-full hover:bg-gray-300 transition"><Plus size={16} /></button>
                                </div>
                            </div>
                        ))} 
                        
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

                    </div> // CIERRE DEL div space-y-4
                )} 
            </div> // CIERRE DEL div overflow-y-auto

            {/* Botones de Acción (Fijos en la parte inferior) */}
            <div className="p-4 border-t absolute bottom-0 w-full bg-white">
                <button onClick={sendOrder} className="w-full flex items-center justify-center bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-green-600 transition">
                    <Truck size={20} className="mr-2" />Enviar Pedido por WhatsApp
                </button>
                <button onClick={clearCart} className="w-full text-center text-sm text-gray-500 mt-2 hover:text-red-500 transition">Vaciar Carrito</button>
            </div>
        </div> // CIERRE DEL DIV PRINCIPAL
    );
};

const MenuItemCard = ({ item }) => {
    const { addToCart, formatPrice, isAdmin, deleteItem, startEdit } = useContext(MenuContext);
    const handleAddToCart = () => { addToCart(item); };
    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row transition-all duration-300 hover:shadow-xl">
            <div className="sm:w-1/4 w-full h-32 sm:h-40 flex-shrink-0 relative">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/400x300/a855f7/ffffff?text=${encodeURIComponent(item.name || 'Producto')}` }}/>
                {isAdmin && (<div className="absolute top-2 right-2 flex space-x-2">
                         <button onClick={() => startEdit(item)} className="p-2 bg-yellow-400 text-white rounded-full shadow-lg hover:bg-yellow-500 transition" title="Editar"><Edit size={16} /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition" title="Eliminar"><Trash2 size={16} /></button>
                    </div>)}
            </div>
            <div className="flex-1 p-5 flex flex-col justify-between">
                <div><h2 className="text-xl font-bold text-gray-800 mb-1">{item.name}</h2><p className="text-gray-600 text-sm mb-3">{item.description}</p></div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-2xl font-extrabold text-purple-700">{formatPrice(item.price)}</span>
                    <button onClick={handleAddToCart} className="flex items-center bg-green-500 text-white font-semibold py-2 px-4 rounded-full shadow-md hover:bg-green-600 transition transform hover:scale-105 active:scale-95">
                        <Plus size={18} className="mr-1" />Añadir
                    </button>
                </div>
            </div>
        </div>
    );
};

const MenuList = () => {
    const { menuItems, isLoading, error } = useContext(MenuContext);

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-8 text-center bg-red-100 border border-red-400 rounded-lg my-8">
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-red-800">Error Crítico de Conexión</h2>
                <p className="text-red-700 mt-2">{error}</p>
                <p className="text-sm text-red-600 mt-2">1. ¿Reemplazaste las claves en FIREBASE_CONFIG? 2. ¿Publicaste las Reglas de Seguridad de Firestore? 3. ¿Existe la colección 'menuItems'?</p>
            </div>
        );
    }

    if (isLoading) {
        return (<div className="max-w-4xl mx-auto p-8 text-center my-16">
                <Loader2 size={48} className="text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-lg text-gray-600">Conectando a Firebase y cargando menú...</p>
            </div>);
    }
    
    if (menuItems.length === 0) {
        return (<div className="max-w-4xl mx-auto p-4 text-center my-8 bg-gray-50 rounded-xl shadow-inner">
                <MenuIcon size={48} className="text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-700">Menú Vacío</h2>
                <p className="text-gray-500 mt-2">
                    {useContext(MenuContext).isAdmin 
                        ? "Usa el botón 'Nuevo Producto' para empezar a añadir ítems."
                        : "No hay productos disponibles por ahora. Vuelve pronto."
                    }
                </p>
            </div>);
    }

    return (
        <main className="max-w-4xl mx-auto p-2 space-y-6 pb-20">
            {menuItems.map(item => (<MenuItemCard key={item.id} item={item} />))}
        </main>
    );
};


// ----------------------------------------------------------------------
// Componente Principal
// ----------------------------------------------------------------------

export default function App() {
    return (
        <PedidosProvider>
            <div className="min-h-screen bg-gray-50 font-[Inter]">
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