
import { MusicKey, AppData, Schema } from './types';

export const MUSIC_KEYS = Object.values(MusicKey);

export const STORAGE_KEY = 'ipac_praise_v3_secure';

const INITIAL_SCHEMA: Schema = {
  ministers: [
    { id: 'm-neto', name: 'Neto', songs: [] },
    { id: 'm-mayke', name: 'Mayke', songs: [] },
    { id: 'm-alisson', name: 'Alisson', songs: [] },
    { id: 'm-lilian', name: 'Lilian', songs: [] },
    { id: 'm-andressa', name: 'Andressa', songs: [] },
    { id: 'm-carlao', name: 'Carlão', songs: [] },
  ],
  scaleImages: [],
  rehearsalInfo: 'Agenda Oficial IPAC:\nQuarta: 19:30\nDomingo: 17:30\n\nAtenção com os atrasos!'
};

export const INITIAL_DATA: AppData = {
  published: INITIAL_SCHEMA,
  draft: INITIAL_SCHEMA,
  logs: []
};
