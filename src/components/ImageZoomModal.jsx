import React from 'react';

// Este componente usa un portal o se renderiza sobre la app principal (z-index alto)
const ImageZoomModal = ({ imageUrl, onClose }) => {
    
    if (!imageUrl) return null; // No renderizar si no hay URL

    return (
        // Fondo Oscuro (Overlay)
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
            onClick={onClose} // Cierra al hacer clic en el fondo
        >
            {/* Contenedor de la Imagen */}
            <div 
                className="relative max-w-4xl max-h-full"
                onClick={(e) => e.stopPropagation()} // Evita que el clic en la imagen cierre el modal
            >
                {/* Botón de Cierre (X) */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-white text-3xl font-bold bg-gray-900 bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-80 transition z-50"
                    title="Cerrar"
                >
                    &times;
                </button>

                {/* Imagen Zoom */}
                <img 
                    src={imageUrl} 
                    alt="Imagen Ampliada del Producto" 
                    // Clases para que la imagen se ajuste y se muestre bien
                    className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://placehold.co/800x600?text=Error+Cargando+Imagen";
                    }}
                />
            </div>
        </div>
    );
};

export default ImageZoomModal;