
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
  Wifi,
  WifiOff,
  Cloud,
  CloudOff
} from 'lucide-react';
import { AppData, Minister, Song, MusicKey, ScaleImage } from './types';
import { STORAGE_KEY, INITIAL_DATA, MUSIC_KEYS } from './constants';

/**
 * CONFIGURAÇÃO DO BANCO DE DADOS EM NUVEM (JSONBin.io)
 * Este ID e Chave permitem a colaboração em tempo real.
 */
const BIN_ID = '67c06283e41b4d34e4a0593b'; 
const API_KEY = '$2a$10$W2zW.m/u8S/mO7xP/eF.i.7U9N8N0R8S.9Z.O.O.O.O.O.O.O.O'; 
const CLOUD_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'songs' | 'scale'>('songs');
  
  // Tenta carregar do localStorage imediatamente para evitar tela branca
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');
  const [isEditingRehearsal, setIsEditingRehearsal] = useState(false);
  const [tempRehearsal, setTempRehearsal] = useState('');

  // Modais
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

  const isUpdatingRef = useRef(false);

  // FUNÇÃO: Sincronizar com a Nuvem
  const loadFromCloud = useCallback(async () => {
    if (isUpdatingRef.current) return;
    
    try {
      const response = await fetch(CLOUD_URL, {
        headers: { 
          'X-Master-Key': API_KEY,
          'X-Bin-Meta': 'false' 
        }
      });
      
      if (!response.ok) throw new Error('Servidor Offline');
      
      const remoteData = await response.json();
      
      // Só atualiza se o conteúdo for diferente para economizar renderização
      if (JSON.stringify(remoteData) !== JSON.stringify(data)) {
        setData(remoteData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
      }
      setSyncStatus('synced');
    } catch (e) {
      console.warn('Modo Offline: Sincronização falhou.');
      setSyncStatus('local');
    }
  }, [data]);

  const saveToCloud = async (updatedData: AppData) => {
    setSyncStatus('syncing');
    isUpdatingRef.current = true;
    
    // Salva no local imediatamente (otimismo)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));

    try {
      const response = await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY
        },
        body: JSON.stringify(updatedData)
      });
      
      if (!response.ok) throw new Error('Falha no upload');
      setSyncStatus('synced');
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    } finally {
      isUpdatingRef.current = false;
    }
  };

  useEffect(() => {
    // Carregamento inicial da nuvem
    loadFromCloud();
    // Verifica atualizações a cada 20 segundos
    const interval = setInterval(loadFromCloud, 20000);
    return () => clearInterval(interval);
  }, [loadFromCloud]);

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
      message: `Deseja remover ${name}? Isso apagará as músicas dele globalmente.`,
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
    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande! Use fotos de até 2MB.");
      return;
    }
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
      message: 'Remover esta foto da escala para todos?',
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
    <div className="min-h-screen pb-24 bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header Fixo */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <Music size={22} />
            </div>
            <h1 className="text-xl md:text-2xl font-brand font-black text-slate-900 tracking-tighter">
              LOUVOR <span className="text-indigo-600">IPAC</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                <RefreshCw size={12} className="animate-spin" />
                SALVANDO...
              </div>
            )}
            {syncStatus === 'synced' && (
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <Cloud size={12} />
                NUVEM ATIVA
              </div>
            )}
            {syncStatus === 'local' && (
              <button 
                onClick={loadFromCloud}
                className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-200"
              >
                <CloudOff size={12} />
                MODO LOCAL
              </button>
            )}
            {syncStatus === 'error' && (
              <div className="flex items-center gap-2 text-[10px] font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                <WifiOff size={12} />
                ERRO
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Abas Superiores */}
        <div className="flex bg-white p-1.5 rounded-[1.2rem] shadow-sm border border-slate-200 mb-10 max-w-[280px] mx-auto">
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${
              activeTab === 'songs' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-400 hover:text-indigo-600'
            }`}
          >
            <Music size={16} /> MÚSICAS
          </button>
          <button
            onClick={() => setActiveTab('scale')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${
              activeTab === 'scale' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-400 hover:text-indigo-600'
            }`}
          >
            <Calendar size={16} /> ESCALA
          </button>
        </div>

        {activeTab === 'songs' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

            {/* Informações de Ensaio */}
            <div className="mt-20 bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3 text-slate-900 font-black text-xs uppercase tracking-widest">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                    <Clock size={18} />
                  </div>
                  Agenda da Igreja
                </div>
                <button 
                  onClick={() => {
                    if (isEditingRehearsal) saveRehearsalInfo();
                    else { setTempRehearsal(data.rehearsalInfo); setIsEditingRehearsal(true); }
                  }}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                >
                  {isEditingRehearsal ? <Check size={20} className="text-emerald-500" /> : <Edit2 size={16} />}
                </button>
              </div>
              
              {isEditingRehearsal ? (
                <textarea
                  value={tempRehearsal}
                  onChange={(e) => setTempRehearsal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:outline-none min-h-[160px] transition-all"
                  autoFocus
                />
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-slate-600 leading-relaxed font-semibold whitespace-pre-line bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    {data.rehearsalInfo}
                  </p>
                  <div className="flex items-center gap-4 bg-red-50 p-5 rounded-3xl border border-red-100">
                    <div className="bg-red-500 p-2 rounded-xl text-white">
                      <AlertTriangle size={18} />
                    </div>
                    <p className="text-xs font-black text-red-700 leading-snug uppercase tracking-tight">
                      Proibido atrasos acima de 10 min. Avisar no grupo se houver imprevistos!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <Calendar className="text-indigo-600" size={24} />
                Escala de Louvor
              </h2>
              <label className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl shadow-xl transition-all hover:scale-105 cursor-pointer flex items-center gap-2">
                <Plus size={20} />
                <span className="hidden sm:inline font-bold text-sm">Postar Escala</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>

            {data.scaleImages.length === 0 ? (
              <div className="text-center py-32 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <ImageIcon size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Nenhuma escala postada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {data.scaleImages.map((img) => (
                  <div key={img.id} className="bg-white p-4 rounded-[2.5rem] shadow-lg border border-slate-100 group relative">
                    <img src={img.url} alt="Escala" className="w-full rounded-[2rem] object-contain bg-slate-50 max-h-[700px] shadow-inner" />
                    <div className="mt-5 flex justify-between items-center px-3 pb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Publicado em: {img.date}</span>
                      <button onClick={() => askDeleteScaleImage(img.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all p-2.5 rounded-2xl">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: NOVO MINISTRO */}
      {showAddMinisterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-800 text-center mb-1 tracking-tight">Novo Ministro</h3>
            <p className="text-slate-400 text-center text-sm mb-8 font-medium">Digite o nome do líder do bloco.</p>
            <input 
              type="text" 
              value={newMinisterName}
              onChange={(e) => setNewMinisterName(e.target.value)}
              placeholder="Ex: Alisson Santos"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none mb-8 transition-all"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddMinisterModal(false)} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200">SAIR</button>
              <button onClick={handleAddMinister} className="bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">CRIAR</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-800 text-center mb-1 tracking-tight">Nova Música</h3>
            <p className="text-slate-400 text-center text-[10px] mb-8 uppercase tracking-widest font-black">Preenchimento Obrigatório *</p>
            
            <div className="space-y-6 mb-10">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Título da Música *</label>
                <input 
                  type="text" 
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                  placeholder="Ex: Bondade de Deus"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Cantor / Banda *</label>
                <input 
                  type="text" 
                  value={newSongArtist}
                  onChange={(e) => setNewSongArtist(e.target.value)}
                  placeholder="Ex: Isaias Saad"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddSongModal(null)} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200">FECHAR</button>
              <button 
                onClick={handleAddSong} 
                disabled={!newSongTitle.trim() || !newSongArtist.trim()}
                className={`text-white font-black py-4 rounded-2xl shadow-lg transition-all ${
                  (!newSongTitle.trim() || !newSongArtist.trim()) 
                  ? 'bg-slate-200 cursor-not-allowed text-slate-400' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                ADICIONAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">{confirmModal.title}</h3>
            <p className="text-slate-500 text-sm mb-10 px-2 font-medium leading-relaxed">{confirmModal.message}</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200">CANCELAR</button>
              <button onClick={confirmModal.onConfirm} className="bg-red-500 text-white font-black py-4 rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/20">REMOVER</button>
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
    <div className="bg-white rounded-[3rem] shadow-md border border-slate-100 overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-1 transition-all h-full">
      <div className="bg-slate-50/80 p-7 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Users size={20} />
          </div>
          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{minister.name}</h3>
        </div>
        <button onClick={onDelete} className="text-slate-300 hover:text-red-500 p-2.5 rounded-full hover:bg-red-50 transition-all">
          <X size={24} />
        </button>
      </div>

      <div className="p-7 flex-1 space-y-5">
        {minister.songs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">Vazio</div>
        ) : (
          minister.songs.map((song) => (
            <div key={song.id} className="bg-slate-50/80 border border-slate-100 rounded-[2rem] p-6 space-y-5 hover:border-indigo-200 hover:bg-white transition-all group">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-1.5">
                  <input 
                    type="text" 
                    value={song.title} 
                    onChange={(e) => onUpdateSong(song.id, { title: e.target.value })} 
                    className="bg-transparent border-none font-black text-slate-900 focus:ring-0 p-0 text-[17px] w-full placeholder:text-slate-300"
                    placeholder="Nome da Música"
                  />
                  <div className="flex items-center gap-2 text-slate-400">
                    <User size={14} className="text-indigo-400" />
                    <input 
                      type="text" 
                      value={song.artist} 
                      onChange={(e) => onUpdateSong(song.id, { artist: e.target.value })} 
                      className="bg-transparent border-none text-[11px] font-black uppercase tracking-wider focus:ring-0 p-0 w-full placeholder:text-slate-300"
                      placeholder="Cantor"
                    />
                  </div>
                </div>
                <button onClick={() => onDeleteSong(song.id)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-2 mb-2 block">Selecione o seu Tom</label>
                  <div className="relative">
                    <select
                      value={song.key}
                      onChange={(e) => onUpdateSong(song.id, { key: e.target.value as MusicKey })}
                      className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-[10px] font-black rounded-2xl px-5 py-3 pr-10 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer uppercase tracking-widest transition-all"
                    >
                      {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1 min-w-[180px] relative">
                  <input 
                    type="text" 
                    value={song.youtubeLink} 
                    onChange={(e) => onUpdateSong(song.id, { youtubeLink: e.target.value })} 
                    className="w-full text-[10px] font-black bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 focus:ring-4 focus:ring-red-500/10 placeholder:text-slate-300 transition-all uppercase tracking-widest"
                    placeholder="Link Youtube"
                  />
                  <Youtube size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" />
                  {song.youtubeLink && (
                    <a href={song.youtubeLink.includes('http') ? song.youtubeLink : `https://www.youtube.com/results?search_query=${song.title} ${song.artist}`} target="_blank" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600 transition-colors p-1">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-7 pt-0">
        <button onClick={onAddSong} className="w-full py-5 border-2 border-dashed border-indigo-100 rounded-[2rem] text-indigo-500 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2">
          <Plus size={20} /> ADICIONAR LOUVOR
        </button>
      </div>
    </div>
  );
};

export default App;
