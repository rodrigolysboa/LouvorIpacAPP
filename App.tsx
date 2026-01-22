
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
  Edit2,
  Check,
  AlertTriangle,
  User,
  WifiOff,
  Cloud,
  CloudOff,
  Save
} from 'lucide-react';
import { AppData, Minister, Song, MusicKey, ScaleImage } from './types';
import { STORAGE_KEY, INITIAL_DATA, MUSIC_KEYS } from './constants';

/**
 * CONFIGURAÇÃO DO BANCO DE DADOS EM NUVEM
 */
const BIN_ID = '67c06283e41b4d34e4a0593b'; 
const API_KEY = '$2a$10$W2zW.m/u8S/mO7xP/eF.i.7U9N8N0R8S.9Z.O.O.O.O.O.O.O.O'; 
const CLOUD_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'songs' | 'scale'>('songs');
  
  // Estado inicial robusto
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_DATA;
    } catch {
      return INITIAL_DATA;
    }
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

  // Refs de controle de fluxo para evitar loops e race conditions
  const isSavingRef = useRef(false);
  const pendingUpdateRef = useRef<AppData | null>(null);
  const retryCountRef = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FUNÇÃO: Carregar dados da nuvem
  const loadFromCloud = useCallback(async (force = false) => {
    // Não carrega se estiver salvando algo no momento (para não sobrescrever o que o usuário está enviando)
    if ((isSavingRef.current || isEditingRehearsal) && !force) return;
    
    try {
      const response = await fetch(CLOUD_URL, {
        method: 'GET',
        headers: { 
          'X-Master-Key': API_KEY,
          'X-Bin-Meta': 'false' 
        }
      });
      
      if (!response.ok) throw new Error('Servidor indisponível');
      
      const remoteData = await response.json();
      
      // Sincronização inteligente: Só atualiza se for realmente diferente
      const remoteStr = JSON.stringify(remoteData);
      const localStr = JSON.stringify(data);
      
      if (remoteStr !== localStr) {
        setData(remoteData);
        localStorage.setItem(STORAGE_KEY, remoteStr);
      }
      setSyncStatus('synced');
      retryCountRef.current = 0;
    } catch (e) {
      console.warn('Sync falhou, operando em modo local.');
      setSyncStatus('local');
    }
  }, [data, isEditingRehearsal]);

  // FUNÇÃO: Salvar dados na nuvem com lógica de fila e retentativa
  const performSave = async (updatedData: AppData) => {
    if (isSavingRef.current) {
      pendingUpdateRef.current = updatedData;
      return;
    }

    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const response = await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY
        },
        body: JSON.stringify(updatedData)
      });
      
      if (!response.ok) {
        if (response.status === 429) throw new Error('Limite de velocidade excedido');
        throw new Error('Falha no upload');
      }
      
      setSyncStatus('synced');
      retryCountRef.current = 0;
      
      // Se houve uma atualização enquanto este salvamento ocorria, envia a nova agora
      if (pendingUpdateRef.current) {
        const nextData = pendingUpdateRef.current;
        pendingUpdateRef.current = null;
        isSavingRef.current = false;
        performSave(nextData);
      } else {
        isSavingRef.current = false;
      }
    } catch (e) {
      console.error('Erro ao salvar:', e);
      isSavingRef.current = false;
      
      // Tenta novamente até 3 vezes com delay progressivo
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        const delay = retryCountRef.current * 2000;
        setTimeout(() => performSave(updatedData), delay);
      } else {
        setSyncStatus('error');
      }
    }
  };

  const triggerUpdate = (newData: AppData) => {
    setData(newData);
    // Salva no local imediatamente (segurança extrema)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));

    // Debounce de 1 segundo para agrupar mudanças rápidas (digitação)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performSave(newData), 1000);
  };

  useEffect(() => {
    loadFromCloud();
    const interval = setInterval(() => loadFromCloud(), 15000);
    return () => {
      clearInterval(interval);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loadFromCloud]);

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
      title: 'Remover Ministro',
      message: `Isso apagará o bloco do(a) ${name} para todos. Tem certeza?`,
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
    if (file.size > 1 * 1024 * 1024) {
      alert("Imagem muito grande! Reduza a foto ou use uma de até 1MB para não travar o servidor.");
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
      title: 'Excluir Foto',
      message: 'Deseja remover esta escala da nuvem?',
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
      {/* Header Fixo e Resiliente */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100 transition-transform active:scale-90">
              <Music size={22} />
            </div>
            <h1 className="text-xl md:text-2xl font-brand font-black text-slate-900 tracking-tighter">
              LOUVOR <span className="text-indigo-600 uppercase">Ipac</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                SALVANDO NA NUVEM...
              </div>
            )}
            {syncStatus === 'synced' && (
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                <Cloud size={12} />
                SINCRONIZADO
              </div>
            )}
            {syncStatus === 'local' && (
              <button 
                onClick={() => loadFromCloud(true)}
                className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-200 transition-all"
              >
                <CloudOff size={12} />
                MODO LOCAL
              </button>
            )}
            {syncStatus === 'error' && (
              <button 
                onClick={() => { retryCountRef.current = 0; performSave(data); }}
                className="flex items-center gap-2 text-[10px] font-black text-white bg-red-500 px-4 py-2 rounded-full shadow-lg shadow-red-200 animate-bounce"
              >
                <WifiOff size={12} />
                TENTAR SALVAR AGORA
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Seletor de Abas Estilizado */}
        <div className="flex bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-200 mb-10 max-w-[300px] mx-auto overflow-hidden">
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black tracking-widest transition-all duration-300 ${
              activeTab === 'songs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <Music size={16} /> MÚSICAS
          </button>
          <button
            onClick={() => setActiveTab('scale')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black tracking-widest transition-all duration-300 ${
              activeTab === 'scale' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <Calendar size={16} /> ESCALA
          </button>
        </div>

        {activeTab === 'songs' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <Users className="text-indigo-600" size={24} />
                Ministros
              </h2>
              <button
                onClick={() => setShowAddMinisterModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
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

            {/* Quadro de Avisos */}
            <div className="mt-20 bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[5rem] -mr-16 -mt-16 transition-all group-hover:scale-110" />
              <div className="flex justify-between items-center mb-8 relative">
                <div className="flex items-center gap-3 text-slate-900 font-black text-xs uppercase tracking-[0.2em]">
                  <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md">
                    <Clock size={18} />
                  </div>
                  Agenda e Avisos
                </div>
                <button 
                  onClick={() => {
                    if (isEditingRehearsal) saveRehearsalInfo();
                    else { setTempRehearsal(data.rehearsalInfo); setIsEditingRehearsal(true); }
                  }}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                >
                  {isEditingRehearsal ? <Check size={24} className="text-emerald-500" /> : <Edit2 size={18} />}
                </button>
              </div>
              
              {isEditingRehearsal ? (
                <textarea
                  value={tempRehearsal}
                  onChange={(e) => setTempRehearsal(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-indigo-100 rounded-[2rem] p-6 text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none min-h-[200px] transition-all"
                  autoFocus
                  placeholder="Digite os dias e horários de ensaio..."
                />
              ) : (
                <div className="space-y-8 relative">
                  <div className="text-sm text-slate-600 leading-relaxed font-bold whitespace-pre-line bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                    {data.rehearsalInfo || "Nenhum aviso no momento."}
                  </div>
                  <div className="flex items-center gap-5 bg-red-50 p-6 rounded-[2rem] border border-red-100 shadow-sm">
                    <div className="bg-red-500 p-3 rounded-2xl text-white animate-pulse shadow-lg shadow-red-200">
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Regra de Pontualidade</h4>
                      <p className="text-xs font-black text-red-700 leading-snug uppercase tracking-tight">
                        Atrasos acima de 10 min não são tolerados. Avisar no grupo se houver imprevistos.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <Calendar className="text-indigo-600" size={24} />
                Escala de Louvor
              </h2>
              <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3.5 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2">
                <Plus size={20} />
                <span className="font-bold text-sm">Postar Escala</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>

            {data.scaleImages.length === 0 ? (
              <div className="text-center py-40 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
                <div className="bg-slate-50 p-6 rounded-full text-slate-300">
                  <ImageIcon size={60} />
                </div>
                <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">Nenhuma escala postada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                {data.scaleImages.map((img) => (
                  <div key={img.id} className="bg-white p-5 rounded-[3rem] shadow-lg border border-slate-100 group relative hover:shadow-2xl transition-all duration-500 overflow-hidden">
                    <div className="overflow-hidden rounded-[2.2rem] shadow-inner bg-slate-50">
                      <img src={img.url} alt="Escala" className="w-full h-auto object-contain max-h-[800px] transition-transform duration-700 group-hover:scale-[1.02]" />
                    </div>
                    <div className="mt-6 flex justify-between items-center px-4 pb-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Publicado em</span>
                        <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">{img.date}</span>
                      </div>
                      <button onClick={() => askDeleteScaleImage(img.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all p-3 rounded-2xl shadow-sm">
                        <Trash2 size={22} />
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-800 text-center mb-1 tracking-tight">Novo Ministro</h3>
            <p className="text-slate-400 text-center text-xs mb-10 font-black uppercase tracking-widest">Crie um novo bloco</p>
            <input 
              type="text" 
              value={newMinisterName}
              onChange={(e) => setNewMinisterName(e.target.value)}
              placeholder="Ex: Alisson Santos"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-800 font-black focus:border-indigo-500 focus:bg-white focus:outline-none mb-10 transition-all shadow-sm"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setShowAddMinisterModal(false)} className="bg-slate-100 text-slate-500 font-black py-5 rounded-2xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-[11px]">SAIR</button>
              <button onClick={handleAddMinister} className="bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all uppercase tracking-widest text-[11px]">CRIAR AGORA</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-800 text-center mb-1 tracking-tight">Nova Música</h3>
            <p className="text-slate-400 text-center text-[10px] mb-10 uppercase tracking-[0.2em] font-black">Preencha os campos obrigatórios *</p>
            
            <div className="space-y-8 mb-12">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block">Título da Música *</label>
                <input 
                  type="text" 
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                  placeholder="Ex: Bondade de Deus"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-800 font-black focus:border-indigo-500 focus:bg-white focus:outline-none transition-all shadow-sm"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block">Cantor / Banda *</label>
                <input 
                  type="text" 
                  value={newSongArtist}
                  onChange={(e) => setNewSongArtist(e.target.value)}
                  placeholder="Ex: Isaias Saad"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-800 font-black focus:border-indigo-500 focus:bg-white focus:outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setShowAddSongModal(null)} className="bg-slate-100 text-slate-500 font-black py-5 rounded-2xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-[11px]">FECHAR</button>
              <button 
                onClick={handleAddSong} 
                disabled={!newSongTitle.trim() || !newSongArtist.trim()}
                className={`text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-[11px] ${
                  (!newSongTitle.trim() || !newSongArtist.trim()) 
                  ? 'bg-slate-200 cursor-not-allowed text-slate-400 shadow-none' 
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[70] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-sm p-12 animate-in zoom-in-95 duration-300 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-inner">
              <AlertTriangle className="text-red-500" size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">{confirmModal.title}</h3>
            <p className="text-slate-500 text-sm mb-12 px-2 font-bold leading-relaxed">{confirmModal.message}</p>
            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))} className="bg-slate-100 text-slate-600 font-black py-5 rounded-[1.5rem] hover:bg-slate-200 transition-colors uppercase tracking-widest text-[10px]">CANCELAR</button>
              <button onClick={confirmModal.onConfirm} className="bg-red-500 text-white font-black py-5 rounded-[1.5rem] hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all uppercase tracking-widest text-[10px]">SIM, REMOVER</button>
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
    <div className="bg-white rounded-[3.5rem] shadow-md border border-slate-100 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-500 h-full group/card">
      <div className="bg-slate-50/80 p-8 border-b border-slate-100 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 transform transition-transform group-hover/card:scale-110">
            <Users size={22} />
          </div>
          <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter">{minister.name}</h3>
        </div>
        <button onClick={onDelete} className="text-slate-300 hover:text-red-500 p-3 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover/card:opacity-100">
          <X size={28} />
        </button>
      </div>

      <div className="p-8 flex-1 space-y-6">
        {minister.songs.length === 0 ? (
          <div className="py-16 text-center text-slate-300 font-black text-[11px] uppercase tracking-[0.4em] bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">Sem músicas</div>
        ) : (
          minister.songs.map((song) => (
            <div key={song.id} className="bg-slate-50/80 border-2 border-slate-100 rounded-[2.5rem] p-7 space-y-6 hover:border-indigo-400 hover:bg-white transition-all duration-300 group shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <input 
                    type="text" 
                    value={song.title} 
                    onChange={(e) => onUpdateSong(song.id, { title: e.target.value })} 
                    className="bg-transparent border-none font-black text-slate-900 focus:ring-0 p-0 text-[18px] w-full placeholder:text-slate-300 tracking-tight"
                    placeholder="Nome da Música"
                  />
                  <div className="flex items-center gap-2 text-slate-400">
                    <User size={16} className="text-indigo-500" />
                    <input 
                      type="text" 
                      value={song.artist} 
                      onChange={(e) => onUpdateSong(song.id, { artist: e.target.value })} 
                      className="bg-transparent border-none text-[12px] font-black uppercase tracking-widest focus:ring-0 p-0 w-full placeholder:text-slate-300"
                      placeholder="Nome do Cantor"
                    />
                  </div>
                </div>
                <button onClick={() => onDeleteSong(song.id)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1">
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-5">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ml-3 mb-2.5 block">Tom Vocal</label>
                  <div className="relative">
                    <select
                      value={song.key}
                      onChange={(e) => onUpdateSong(song.id, { key: e.target.value as MusicKey })}
                      className="w-full appearance-none bg-white border-2 border-slate-200 text-slate-800 text-[11px] font-black rounded-2xl px-6 py-4 pr-12 focus:border-indigo-500 focus:ring-0 cursor-pointer uppercase tracking-widest transition-all shadow-sm"
                    >
                      {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1 min-w-[200px] relative">
                  <label className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] ml-3 mb-2.5 block">Youtube / Cifra</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={song.youtubeLink} 
                      onChange={(e) => onUpdateSong(song.id, { youtubeLink: e.target.value })} 
                      className="w-full text-[11px] font-black bg-white border-2 border-slate-200 rounded-2xl py-4 pl-12 pr-6 focus:border-red-500 focus:ring-0 placeholder:text-slate-300 transition-all uppercase tracking-widest shadow-sm"
                      placeholder="Link do Louvor"
                    />
                    <Youtube size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-red-500" />
                    {song.youtubeLink && (
                      <a href={song.youtubeLink.includes('http') ? song.youtubeLink : `https://www.youtube.com/results?search_query=${song.title} ${song.artist}`} target="_blank" className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600 transition-colors p-1">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-8 pt-0">
        <button onClick={onAddSong} className="w-full py-6 border-4 border-dashed border-indigo-50 rounded-[2.5rem] text-indigo-400 font-black text-[12px] uppercase tracking-[0.3em] hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-3">
          <Plus size={24} /> ADICIONAR LOUVOR
        </button>
      </div>
    </div>
  );
};

export default App;
