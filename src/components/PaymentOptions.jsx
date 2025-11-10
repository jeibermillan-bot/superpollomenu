// components/PaymentOptions.jsx (¡Reemplazar el contenido completo!)
import React from 'react';
import { CreditCard, Wallet, Smartphone, Truck, Check, X } from 'lucide-react';

// Información de contacto
const CONTACT_INFO = {
    nequi: { number: '310 762 7575', name: 'Nequi', color: 'bg-orange-500 hover:bg-orange-600' }, // <--- ¡ACTUALIZA TU NÚMERO!
    daviplata: { number: '320 762 7575', name: 'DaviPlata', color: 'bg-red-600 hover:bg-red-700' }, // <--- ¡ACTUALIZA TU NÚMERO!
};

// El componente ahora recibe las props del carrito: el método seleccionado y la función para cambiarlo.
function PaymentOptions({ selectedMethod, setPaymentMethod, totalAmount }) {

    const renderPaymentDetails = () => {
        if (selectedMethod === 'nequi' || selectedMethod === 'daviplata') {
            const info = CONTACT_INFO[selectedMethod];
            return (
                <div className="mt-4 p-4 border-l-4 border-green-500 bg-green-50 rounded-lg shadow-inner text-green-900">
                    <h3 className="text-lg font-bold flex items-center mb-1">
                        <Check size={20} className="mr-2 text-green-600" /> ¡Has elegido {info.name}!
                    </h3>
                    <p className="text-sm">Por favor, realiza la transferencia del total ({totalAmount}) a este número:</p>
                    <p className="text-4xl font-extrabold tracking-wider mt-2 mb-1 text-blue-700">
                        {info.number}
                    </p>
                    <p className="text-xs mt-2 text-gray-600">Una vez realizada, envía el comprobante al confirmar el pedido.</p>
                </div>
            );
        }
        
        if (selectedMethod === 'efectivo') {
            return (
                <div className="mt-4 p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-lg text-yellow-800">
                    <p className="font-semibold flex items-center"><Wallet size={18} className="mr-2"/> Pago en Efectivo al recoger.</p>
                </div>
            );
        } 
        
        if (selectedMethod === 'contra_entrega') {
            return (
                <div className="mt-4 p-4 border-l-4 border-blue-500 bg-blue-50 rounded-lg text-blue-800">
                    <p className="font-semibold flex items-center"><Truck size={18} className="mr-2"/> Pago Contra Entrega (Solo efectivo al repartidor).</p>
                </div>
            );
        }

        return null;
    };

    const isSelected = (method) => selectedMethod === method;

    return (
        <div className="p-4 border-t border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Elige tu Pago</h2>
            
            <div className="flex flex-col gap-3">
                
                {/* Opción Nequi */}
                <button 
                    onClick={() => setPaymentMethod('nequi')}
                    className={`flex justify-start items-center p-3 rounded-lg font-semibold transition duration-200 ${isSelected('nequi') ? CONTACT_INFO.nequi.color : 'bg-gray-100 hover:bg-gray-200'} ${isSelected('nequi') ? 'text-white shadow-md' : 'text-gray-800'}`}
                >
                    <Smartphone size={20} className="mr-3" /> Transferencia Nequi
                </button>

                {/* Opción DaviPlata */}
                <button 
                    onClick={() => setPaymentMethod('daviplata')}
                    className={`flex justify-start items-center p-3 rounded-lg font-semibold transition duration-200 ${isSelected('daviplata') ? CONTACT_INFO.daviplata.color : 'bg-gray-100 hover:bg-gray-200'} ${isSelected('daviplata') ? 'text-white shadow-md' : 'text-gray-800'}`}
                >
                    <Smartphone size={20} className="mr-3" /> Transferencia DaviPlata
                </button>
                
                {/* Opción Efectivo */}
                <button 
                    onClick={() => setPaymentMethod('efectivo')}
                    className={`flex justify-start items-center p-3 rounded-lg font-semibold transition duration-200 ${isSelected('efectivo') ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-100 hover:bg-gray-200'} ${isSelected('efectivo') ? 'text-white shadow-md' : 'text-gray-800'}`}
                >
                    <Wallet size={20} className="mr-3" /> Pago en el Local
                </button>

                {/* Opción Contra Entrega */}
                <button 
                    onClick={() => setPaymentMethod('contra_entrega')}
                    className={`flex justify-start items-center p-3 rounded-lg font-semibold transition duration-200 ${isSelected('contra_entrega') ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-100 hover:bg-gray-200'} ${isSelected('contra_entrega') ? 'text-white shadow-md' : 'text-gray-800'}`}
                >
                    <Truck size={20} className="mr-3" /> Pago Contra Entrega
                </button>

            </div>
            
            {renderPaymentDetails()}
        </div>
    );
}

export default PaymentOptions;