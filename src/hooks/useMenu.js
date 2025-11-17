// src/hooks/useMenu.js

import { useContext } from 'react';
import { MenuContext } from '../PedidosProvider'; // Asegúrate de que esta ruta sea correcta

export const useMenu = () => {
    return useContext(MenuContext);
};