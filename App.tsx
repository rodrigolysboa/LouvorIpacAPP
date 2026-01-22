
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Music, 
  Users, 
  Calendar, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Youtube, 
  Image as ImageIcon,
  ChevronDown,
  X,
  RefreshCw,
  Clock,
  AlertCircle,
  Edit2,
  Check,
  AlertTriangle,
  User,
  Globe,
  Wifi,
  WifiOff
} from 'lucide-react';
import { AppData, Minister, Song, MusicKey, ScaleImage } from './types';
import { STORAGE_KEY, INITIAL_DATA, MUSIC_KEYS } from './constants';

/**
 * CONFIGURAÇÃO DA NUVEM (Shared Database)
 * Este ID e Chave permitem que todos os usuários da IPAC acessem os mesmos dados.
 */
const BIN_ID = '67c05ae8e41b4d34e4a05680';
const API_KEY = '$2a$10$W2zW.m/u8S/mO7xP/eF.i.7U9N8N0R8S.9Z.O.O.O.O.O.O.O.O'; 
const CLOUD_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Gerador de ID robusto
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'songs' | 'scale'>('songs');
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'loading'>('loading');
  const [isEditingRehearsal, setIsEditingRehearsal] = useState(false);
  const [tempRehearsal, setTempRehearsal] = useState('');

  // Estados dos Modais
  const [showAddMinisterModal, setShowAddMinisterModal] = useState(false);
  const [newMinisterName, setNewMinisterName] = useState('');
  
  const [showAddSongModal, setShowAddSongModal] = useState<{ministerId: string} | null>(null);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Ref para evitar loops de sincronização
  const isUpdatingRef = useRef(false);

  // FUNÇÃO: Carregar da Nuvem
  const loadFromCloud = useCallback(async (showLoading = false) => {
    if (showLoading) setSyncStatus('syncing');
    try {
      const response = await fetch(CLOUD_URL, {
        headers: { 'X-Master-Key': API_KEY }
      });
      if (!response.ok) throw new Error('Falha ao carregar');
      const result = await response.json();
      
      // Só atualiza se não estivermos no meio de um envio
      if (!isUpdatingRef.current) {
        setData(result.record);
        setSyncStatus('synced');
      }
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  }, []);

  // FUNÇÃO: Salvar na Nuvem
  const saveToCloud = async (updatedData: AppData) => {
    setSyncStatus('syncing');
    isUpdatingRef.current = true;
    try {
      const response = await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY
        },
        body: JSON.stringify(updatedData)
      });
      if (!response.ok) throw new Error('Falha ao salvar');
      setSyncStatus('synced');
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    } finally {
      isUpdatingRef.current = false;
    }
  };

  // Efeito Inicial: Carregar e Polling (Sincronização Automática)
  useEffect(() => {
    loadFromCloud(true);

    // Verifica novos dados a cada 10 segundos (Tempo Real)
    const interval = setInterval(() => {
      loadFromCloud();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadFromCloud]);

  // Wrapper para disparar atualização
  const triggerUpdate = (newData: AppData) => {
    setData(newData);
    saveToCloud(newData);
  };

  const handleAddMinister = () => {
    if (!newMinisterName.trim()) return;
    const newMinister: Minister = {
      id: generateId(),
      name: newMinisterName.trim(),
      songs: []
    };
    triggerUpdate({ ...data, ministers: [...data.ministers, newMinister] });
    setNewMinisterName('');
    setShowAddMinisterModal(false);
  };

  const askDeleteMinister = (id: string, name: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Ministro',
      message: `Tem certeza que deseja remover ${name}? Todas as músicas serão perdidas globalmente.`,
      onConfirm: () => {
        triggerUpdate({ ...data, ministers: data.ministers.filter(m => m.id !== id) });
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleAddSong = () => {
    if (!newSongTitle.trim() || !newSongArtist.trim() || !showAddSongModal) return;
    const newSong: Song = {
      id: generateId(),
      title: newSongTitle.trim(),
      artist: newSongArtist.trim(),
      key: MusicKey.ORIGINAL,
      youtubeLink: ''
    };
    const updatedMinisters = data.ministers.map(m => 
      m.id === showAddSongModal.ministerId ? { ...m, songs: [...m.songs, newSong] } : m
    );
    triggerUpdate({ ...data, ministers: updatedMinisters });
    setNewSongTitle('');
    setNewSongArtist('');
    setShowAddSongModal(null);
  };

  const updateSong = (ministerId: string, songId: string, updates: Partial<Song>) => {
    const updatedMinisters = data.ministers.map(m => 
      m.id === ministerId ? {
        ...m,
        songs: m.songs.map(s => s.id === songId ? { ...s, ...updates } : s)
      } : m
    );
    triggerUpdate({ ...data, ministers: updatedMinisters });
  };

  const deleteSong = (ministerId: string, songId: string) => {
    const updatedMinisters = data.ministers.map(m => 
      m.id === ministerId ? { ...m, songs: m.songs.filter(s => s.id !== songId) } : m
    );
    triggerUpdate({ ...data, ministers: updatedMinisters });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImage: ScaleImage = {
        id: generateId(),
        url: reader.result as string,
        date: new Date().toLocaleDateString('pt-BR')
      };
      triggerUpdate({ ...data, scaleImages: [newImage, ...data.scaleImages] });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const askDeleteScaleImage = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Escala',
      message: 'Deseja remover esta foto da escala para todos?',
      onConfirm: () => {
        triggerUpdate({ ...data, scaleImages: data.scaleImages.filter(img => img.id !== id) });
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const saveRehearsalInfo = () => {
    triggerUpdate({ ...data, rehearsalInfo: tempRehearsal });
    setIsEditingRehearsal(false);
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
              <Music size={22} />
            </div>
            <h1 className="text-xl md:text-2xl font-brand font-bold text-indigo-900">
              LOUVOR <span className="text-indigo-600">IPAC</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                SINCRONIZANDO...
              </div>
            )}
            {syncStatus === 'synced' && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Wifi size={12} />
                ONLINE - IPAC
              </div>
            )}
            {syncStatus === 'loading' && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                <RefreshCw size={12} className="animate-spin" />
                CARREGANDO...
              </div>
            )}
            {syncStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                <WifiOff size={12} />
                ERRO DE CONEXÃO
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Nav Tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-200 mb-8 max-w-xs mx-auto">
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'songs' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'
            }`}
          >
            <Music size={16} /> MÚSICAS
          </button>
          <button
            onClick={() => setActiveTab('scale')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'scale' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'
            }`}
          >
            <Calendar size={16} /> ESCALA
          </button>
        </div>

        {activeTab === 'songs' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                <Users className="text-indigo-600" size={24} />
                Ministros Ativos
              </h2>
              <button
                onClick={() => setShowAddMinisterModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Plus size={20} />
                <span className="hidden sm:inline font-bold text-sm">Novo Bloco</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.ministers.map((minister) => (
                <MinisterCard 
                  key={minister.id} 
                  minister={minister}
                  onDelete={() => askDeleteMinister(minister.id, minister.name)}
                  onAddSong={() => setShowAddSongModal({ ministerId: minister.id })}
                  onUpdateSong={(songId, updates) => updateSong(minister.id, songId, updates)}
                  onDeleteSong={(songId) => deleteSong(minister.id, songId)}
                />
              ))}
            </div>

            {/* Rehearsal Info - Bottom & Discrete */}
            <div className="mt-16 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-gray-900 font-black text-xs uppercase tracking-widest">
                  <Clock size={18} className="text-indigo-600" />
                  Agenda de Ensaios
                </div>
                <button 
                  onClick={() => {
                    if (isEditingRehearsal) saveRehearsalInfo();
                    else { setTempRehearsal(data.rehearsalInfo); setIsEditingRehearsal(true); }
                  }}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                >
                  {isEditingRehearsal ? <Check size={20} className="text-emerald-500" /> : <Edit2 size={16} />}
                </button>
              </div>
              
              {isEditingRehearsal ? (
                <textarea
                  value={tempRehearsal}
                  onChange={(e) => setTempRehearsal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[120px]"
                  autoFocus
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed font-medium whitespace-pre-line">
                    {data.rehearsalInfo}
                  </p>
                  <div className="flex items-center gap-3 bg-red-50 p-4 rounded-2xl border border-red-100">
                    <AlertCircle size={20} className="text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-700 leading-snug">
                      ATENÇÃO: Atrasos acima de 10 min sem aviso prévio não são permitidos.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                <Calendar className="text-indigo-600" size={24} />
                Escala do Mês
              </h2>
              <label className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl shadow-xl transition-all hover:scale-105 cursor-pointer flex items-center gap-2">
                <Plus size={20} />
                <span className="hidden sm:inline font-bold text-sm">Subir Escala</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>

            {data.scaleImages.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <ImageIcon size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-400 font-bold text-sm">Nenhuma escala compartilhada ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {data.scaleImages.map((img) => (
                  <div key={img.id} className="bg-white p-3 rounded-3xl shadow-md border border-gray-100 group relative">
                    <img src={img.url} alt="Escala" className="w-full rounded-2xl object-contain bg-gray-50 max-h-[600px]" />
                    <div className="mt-3 flex justify-between items-center px-2 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Postado em: {img.date}</span>
                      <button onClick={() => askDeleteScaleImage(img.id)} className="text-red-400 hover:text-red-600 transition-colors p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: ADICIONAR MINISTRO */}
      {showAddMinisterModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <Users className="text-indigo-600" size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 text-center mb-2 tracking-tight">Novo Bloco</h3>
            <p className="text-gray-400 text-center text-sm mb-8">Digite o nome do ministro responsável.</p>
            <input 
              type="text" 
              value={newMinisterName}
              onChange={(e) => setNewMinisterName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMinister()}
              placeholder="Ex: Alisson Santos"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-gray-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none mb-6 transition-all"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddMinisterModal(false)} className="bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200">Cancelar</button>
              <button onClick={handleAddMinister} className="bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <Music className="text-indigo-600" size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 text-center mb-1 tracking-tight">Nova Música</h3>
            <p className="text-gray-400 text-center text-xs mb-6">Campos com * são obrigatórios.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Nome da Música *</label>
                <input 
                  type="text" 
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                  placeholder="Ex: Me Atrai"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 text-gray-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Nome do Cantor/Banda *</label>
                <input 
                  type="text" 
                  value={newSongArtist}
                  onChange={(e) => setNewSongArtist(e.target.value)}
                  placeholder="Ex: Toca Casa"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 text-gray-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddSongModal(null)} className="bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200">Cancelar</button>
              <button 
                onClick={handleAddSong} 
                disabled={!newSongTitle.trim() || !newSongArtist.trim()}
                className={`text-white font-black py-4 rounded-2xl shadow-lg transition-all ${
                  (!newSongTitle.trim() || !newSongArtist.trim()) 
                  ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 text-center mb-2 tracking-tight">{confirmModal.title}</h3>
            <p className="text-gray-500 text-center text-sm mb-8 px-2">{confirmModal.message}</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))} className="bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200">Voltar</button>
              <button onClick={confirmModal.onConfirm} className="bg-red-500 text-white font-black py-4 rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/20">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MinisterCard: React.FC<{ 
  minister: Minister; 
  onDelete: () => void; 
  onAddSong: () => void; 
  onUpdateSong: (id: string, up: any) => void; 
  onDeleteSong: (id: string) => void; 
}> = ({ minister, onDelete, onAddSong, onUpdateSong, onDeleteSong }) => {
  return (
    <div className="bg-white rounded-[2rem] shadow-md border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-all h-full">
      <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md">
            <Users size={18} />
          </div>
          <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">{minister.name}</h3>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all">
          <X size={22} />
        </button>
      </div>

      <div className="p-6 flex-1 space-y-4">
        {minister.songs.length === 0 ? (
          <div className="py-8 text-center text-gray-400 font-medium text-sm italic">Clique abaixo para adicionar músicas.</div>
        ) : (
          minister.songs.map((song) => (
            <div key={song.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4 hover:border-indigo-200 transition-colors group">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-1">
                  <input 
                    type="text" 
                    value={song.title} 
                    onChange={(e) => onUpdateSong(song.id, { title: e.target.value })} 
                    className="bg-transparent border-none font-bold text-gray-900 focus:ring-0 p-0 text-base w-full"
                    placeholder="Nome da Música"
                  />
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <User size={12} />
                    <input 
                      type="text" 
                      value={song.artist} 
                      onChange={(e) => onUpdateSong(song.id, { artist: e.target.value })} 
                      className="bg-transparent border-none text-xs font-semibold focus:ring-0 p-0 w-full"
                      placeholder="Nome do Cantor"
                    />
                  </div>
                </div>
                <button onClick={() => onDeleteSong(song.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 pt-1">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3 pt-1">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Selecione o seu Tom</label>
                  <div className="relative">
                    <select
                      value={song.key}
                      onChange={(e) => onUpdateSong(song.id, { key: e.target.value as MusicKey })}
                      className="w-full appearance-none bg-white border border-gray-200 text-indigo-700 text-[10px] font-black rounded-xl px-4 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 cursor-pointer uppercase tracking-widest"
                    >
                      {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1 min-w-[160px] relative">
                  <input 
                    type="text" 
                    value={song.youtubeLink} 
                    onChange={(e) => onUpdateSong(song.id, { youtubeLink: e.target.value })} 
                    className="w-full text-[10px] font-bold bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 focus:ring-2 focus:ring-red-500"
                    placeholder="LINK YOUTUBE"
                  />
                  <Youtube size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                  {song.youtubeLink && (
                    <a href={song.youtubeLink.includes('http') ? song.youtubeLink : `https://www.youtube.com/results?search_query=${song.title} ${song.artist}`} target="_blank" className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 p-1">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-6 pt-0">
        <button onClick={onAddSong} className="w-full py-4 border-2 border-dashed border-indigo-100 rounded-2xl text-indigo-500 font-black text-xs uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2">
          <Plus size={18} /> ADICIONAR MÚSICA
        </button>
      </div>
    </div>
  );
};

export default App;
