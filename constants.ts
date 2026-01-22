
import { MusicKey, AppData } from './types';

export const MUSIC_KEYS = Object.values(MusicKey);

export const STORAGE_KEY = 'ipac_praise_app_data_v1';

export const INITIAL_DATA: AppData = {
  ministers: [
    { id: 'minister-neto', name: 'Neto', songs: [] },
    { id: 'minister-mayke', name: 'Mayke', songs: [] },
    { id: 'minister-alisson', name: 'Alisson', songs: [] },
    { id: 'minister-lilian', name: 'Lilian', songs: [] },
    { id: 'minister-andressa', name: 'Andressa', songs: [] },
    { id: 'minister-carlao', name: 'Carlão', songs: [] },
  ],
  scaleImages: [],
  rehearsalInfo: 'Toda Quarta-feira às 19:30 e Domingo às 17:30.\n\nAVISO: Proibido chegar mais que 10 minutos atrasado sem aviso prévio!'
};
