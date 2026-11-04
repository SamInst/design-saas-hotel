import { contextoStorage } from '../services/api';

export const nomeHotel = () => contextoStorage.get()?.hotel?.nome || 'Hotel';
