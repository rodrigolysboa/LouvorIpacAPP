
export enum MusicKey {
  C = 'C (DÓ)',
  D = 'D (RÉ)',
  E = 'E (MI)',
  F = 'F (FÁ)',
  G = 'G (SOL)',
  A = 'A (LÁ)',
  B = 'B (SI)',
  ORIGINAL = 'ORIGINAL'
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: MusicKey;
  youtubeLink?: string;
}

export interface Minister {
  id: string;
  name: string;
  songs: Song[];
}

export interface ScaleImage {
  id: string;
  url: string;
  date: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

export interface AppData {
  ministers: Minister[];
  scaleImages: ScaleImage[];
  rehearsalInfo: string;
  logs: AuditLog[];
}
