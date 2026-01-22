
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Music, Users, Calendar, Plus, Trash2, ExternalLink, Youtube, 
  Image as ImageIcon, ChevronDown, X, RefreshCw, Clock, Edit2, 
  Check, AlertTriangle, User, WifiOff, Cloud, ShieldCheck, 
  History, LogOut, Send, Globe, Layout, RotateCcw, Eye
} from 'lucide-react';
import { AppData, Minister, Song, MusicKey, Schema, AuditLog } from './types';
import { STORAGE_KEY, INITIAL_DATA, MUSIC_KEYS } from './constants';

const BIN_ID = '67c06283e41b4d34e4a0593b'; 
const API_KEY = '$2a$10$W2zW.m/u8S/mO7xP/eF.i.7U9N8N0R8S.9Z.O.O.O.O.O.O.O.O'; 
const CLOUD_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const generateId = () => Math.random().toString(36).substring(2, 9);

// Função para garantir que os dados tenham a estrutura correta (Evita Tela Branca)
const sanitizeData = (raw: any): AppData => {
  const base = INITIAL_DATA;
  if (!raw) return base;

  return {
    published: {
      ministers: Array.isArray(raw.published?.ministers) ? raw.published.ministers : base.published.ministers,
      scaleImages: Array.isArray(raw.published?.scaleImages) ? raw.published.scaleImages : [],
      rehearsalInfo: raw.published?.rehearsalInfo || base.published.rehearsalInfo
    },
    draft: {
      ministers: Array.isArray(raw.draft?.ministers) ? raw.draft.ministers : base.draft.ministers,
      scaleImages: Array.isArray(raw.draft?.scaleImages) ? raw.draft.scaleImages : [],
      rehearsalInfo: raw.draft?.rehearsalInfo || base.draft.rehearsalInfo
    },
    logs: Array.isArray(raw.logs) ? raw.logs : []
  };
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'songs' | 'scale'>('songs');
  const [viewMode, setViewMode] = useState<'public' | 'editor'>('public');
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('ipac_user_name') || '');
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(!userName);
  const [tempUserName, setTempUserName] = useState('');
  
  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [data, setData] = useState<AppData>(() => {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? sanitizeData(JSON.parse(local)) : INITIAL_DATA;
  });
  
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');
  const [isLoading, setIsLoading] = useState(true);

  const [showAddSongModal, setShowAddSongModal] = useState<{ministerId: string} | null>(null);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');

  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFromCloud = useCallback(async () => {
    if (isSavingRef.current) return;
    try {
      const res = await fetch(CLOUD_URL, { 
        method: 'GET',
        headers: { 
          'X-Master-Key': API_KEY, 
          'X-Bin-Meta': 'false',
          'Cache-Control': 'no-cache'
        } 
      });
      
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      
      const remote = await res.json();
      const sanitized = sanitizeData(remote);
      
      setData(sanitized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      setSyncStatus('synced');
    } catch (err) {
      console.error('Falha na sincronização:', err);
      setSyncStatus('local');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const performSave = async (updatedData: AppData) => {
    isSavingRef.current = true;
    setSyncStatus('syncing');
    try {
      const res = await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body: JSON.stringify(updatedData)
      });
      if (!res.ok) throw new Error();
      setSyncStatus('synced');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    } catch (err) {
      setSyncStatus('error');
      console.error('Erro ao salvar em nuvem:', err);
    } finally {
      isSavingRef.current = false;
    }
  };

  const triggerDraftUpdate = (newDraftSchema: Schema, action: string) => {
    const newLog: AuditLog = {
      id: generateId(),
      user: userName || 'Anônimo',
      action: action,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    };
    
    const updatedData: AppData = {
      ...data,
      draft: { ...data.draft, ...newDraftSchema },
      logs: [newLog, ...(data.logs || [])].slice(0, 30)
    };

    setData(updatedData);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performSave(updatedData), 2000);
  };

  useEffect(() => {
    loadFromCloud();
    const interval = setInterval(loadFromCloud, 30000); // Polling mais leve (30s)
    return () => clearInterval(interval);
  }, [loadFromCloud]);

  const handleSetIdentity = () => {
    const name = tempUserName.trim() || 'Visitante';
    setUserName(name);
    localStorage.setItem('ipac_user_name', name);
    setIsIdentityModalOpen(false);
  };

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      if (prev + 1 === 5) {
        setIsAdminOpen(true);
        return 0;
      }
      return prev + 1;
    });
    setTimeout(() => setLogoClicks(0), 3000);
  };

  const addSong = () => {
    if (!newSongTitle.trim() || !newSongArtist.trim() || !showAddSongModal) return;
    const newSong: Song = { 
      id: generateId(), 
      title: newSongTitle.trim(), 
      artist: newSongArtist.trim(), 
      key: MusicKey.ORIGINAL 
    };
    const newMinisters = (data.draft.ministers || []).map(m => 
      m.id === showAddSongModal.ministerId ? { ...m, songs: [...(m.songs || []), newSong] } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Adicionou "${newSong.title}"`);
    setShowAddSongModal(null); setNewSongTitle(''); setNewSongArtist('');
  };

  const updateSong = (mId: string, sId: string, up: Partial<Song>) => {
    const newMinisters = (data.draft.ministers || []).map(m => 
      m.id === mId ? { ...m, songs: (m.songs || []).map(s => s.id === sId ? { ...s, ...up } : s) } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Alterou música`);
  };

  const deleteSong = (mId: string, sId: string) => {
    const newMinisters = (data.draft.ministers || []).map(m => 
      m.id === mId ? { ...m, songs: (m.songs || []).filter(s => s.id !== sId) } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Removeu música`);
  };

  const publishDraft = () => {
    if (!window.confirm("Publicar agora? Todos os membros verão as alterações.")) return;
    const publishedData: AppData = {
      ...data,
      published: { ...data.draft },
      logs: [{ 
        id: generateId(), 
        user: userName, 
        action: 'PUBLICOU ALTERAÇÕES OFICIAIS', 
        timestamp: new Date().toLocaleTimeString() 
      }, ...data.logs]
    };
    setData(publishedData);
    performSave(publishedData);
    setIsAdminOpen(false);
    setViewMode('public');
  };

  // Garante que o esquema atual nunca seja nulo
  const currentSchema = (viewMode === 'public' ? data?.published : data?.draft) || INITIAL_DATA.published;

  return (
    <div className="min-h-screen pb-24 bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 antialiased">
      {/* Indicador de Status de Rede */}
      <div className={`py-1.5 px-4 text-center text-[9px] font-black uppercase tracking-[0.25em] shadow-inner transition-all duration-500 ${viewMode === 'public' ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-slate-900'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            {viewMode === 'public' ? <Globe size={10} /> : <Edit2 size={10} />}
            {viewMode === 'public' ? 'Mural Oficial IPAC' : 'Rascunho em Edição'}
          </span>
          <span className="flex items-center gap-2">
            {syncStatus === 'synced' ? 'Nuvem OK' : syncStatus === 'syncing' ? 'Sincronizando...' : 'Modo Offline'}
            <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
          </span>
        </div>
      </div>

      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer select-none active:scale-95 transition-transform" onClick={handleLogoClick}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
              <Music size={20} />
            </div>
            <h1 className="text-lg font-brand font-black tracking-tighter uppercase">IPAC <span className="text-indigo-600">Louvor</span></h1>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
              onClick={() => setViewMode(v => v === 'public' ? 'editor' : 'public')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${viewMode === 'editor' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
            >
              {viewMode === 'editor' ? <Eye size={14} /> : <Edit2 size={14} />}
              <span className="hidden sm:inline">{viewMode === 'editor' ? 'MODO VISUALIZAÇÃO' : 'EDITAR LISTA'}</span>
            </button>
            {syncStatus === 'error' && (
              <button onClick={loadFromCloud} className="bg-red-500 text-white p-2 rounded-lg animate-bounce shadow-lg"><WifiOff size={14} /></button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Navegação de Abas */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 mb-8 max-w-[300px] mx-auto overflow-hidden">
          <button onClick={() => setActiveTab('songs')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'songs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>MÚSICAS</button>
          <button onClick={() => setActiveTab('scale')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'scale' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>ESCALA</button>
        </div>

        {activeTab === 'songs' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {(currentSchema.ministers || []).map((m) => (
              <div key={m.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                <div className="flex items-center justify-between p-6 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><User size={18} /></div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">{m.name}</h3>
                  </div>
                  <span className="text-[9px] font-black bg-slate-50 text-slate-400 px-3 py-1 rounded-full uppercase">{m.songs?.length || 0}</span>
                </div>
                
                <div className="p-6 space-y-4 flex-1">
                  {(m.songs || []).map((s) => (
                    <div key={s.id} className="bg-slate-50/40 rounded-[1.5rem] p-4 border border-slate-100 group relative transition-all hover:bg-white hover:border-indigo-50 shadow-sm hover:shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <input 
                            readOnly={viewMode === 'public'}
                            value={s.title} 
                            onChange={(e) => updateSong(m.id, s.id, { title: e.target.value })}
                            className="bg-transparent border-none font-black text-slate-900 text-sm focus:ring-0 p-0 block w-full truncate placeholder:text-slate-300"
                            placeholder="Título"
                          />
                          <input 
                            readOnly={viewMode === 'public'}
                            value={s.artist} 
                            onChange={(e) => updateSong(m.id, s.id, { artist: e.target.value })}
                            className="bg-transparent border-none font-bold text-slate-400 text-[10px] uppercase focus:ring-0 p-0 block w-full truncate placeholder:text-slate-200"
                            placeholder="Artista"
                          />
                        </div>
                        {viewMode === 'editor' && (
                          <button onClick={() => deleteSong(m.id, s.id)} className="text-slate-200 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <select 
                            disabled={viewMode === 'public'}
                            value={s.key || MusicKey.ORIGINAL} 
                            onChange={(e) => updateSong(m.id, s.id, { key: e.target.value as MusicKey })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-[9px] font-black uppercase appearance-none focus:border-indigo-400 focus:ring-0 shadow-sm disabled:bg-slate-50"
                          >
                            {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                        
                        {(s.youtubeLink || viewMode === 'editor') && (
                          <div className="flex-[1.5] flex gap-1.5">
                             <input 
                               readOnly={viewMode === 'public'}
                               placeholder="Link YouTube"
                               value={s.youtubeLink || ''}
                               onChange={(e) => updateSong(m.id, s.id, { youtubeLink: e.target.value })}
                               className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-bold focus:ring-0 shadow-sm truncate placeholder:text-slate-200"
                             />
                             {s.youtubeLink && (
                               <a href={s.youtubeLink.startsWith('http') ? s.youtubeLink : `https://youtube.com/results?search_query=${s.title}`} target="_blank" className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                <Youtube size={12} />
                               </a>
                             )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {viewMode === 'editor' && (
                    <button 
                      onClick={() => setShowAddSongModal({ ministerId: m.id })}
                      className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-black text-[9px] uppercase hover:bg-slate-50 hover:border-indigo-100 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> ADICIONAR LOUVOR
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-40 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
             <ImageIcon size={48} className="mx-auto text-slate-100 mb-4" />
             <p className="text-slate-300 font-black text-[10px] uppercase tracking-[0.3em]">Módulo de Escalas indisponível</p>
          </div>
        )}
      </main>

      {/* Identidade Obrigatória */}
      {isIdentityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><User className="text-indigo-600" size={32} /></div>
            <h3 className="text-xl font-black mb-2 tracking-tighter uppercase text-slate-800">Acesso ao Louvor</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">Quem está acessando o app hoje?</p>
            <input 
              value={tempUserName} onChange={e => setTempUserName(e.target.value)} 
              placeholder="Digite seu nome..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center font-black focus:border-indigo-500 focus:outline-none mb-8 text-sm"
              autoFocus onKeyDown={e => e.key === 'Enter' && handleSetIdentity()}
            />
            <div className="space-y-3">
              <button onClick={handleSetIdentity} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase text-[10px] tracking-widest">ENTRAR</button>
              <button onClick={() => { setTempUserName('Visitante'); handleSetIdentity(); }} className="w-full text-slate-300 font-black py-2 rounded-2xl uppercase text-[8px] tracking-widest hover:text-slate-500 transition-colors">Apenas visualizar</button>
            </div>
          </div>
        </div>
      )}

      {/* Painel de Controle Admin */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-indigo-600" size={24} />
                <h3 className="font-black uppercase tracking-tight text-sm">Administração IPAC</h3>
              </div>
              <button onClick={() => setIsAdminOpen(false)} className="text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
               <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] space-y-4">
                 <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> Publicação Global</h4>
                 <p className="text-[11px] text-indigo-600 font-bold leading-relaxed">O rascunho atual substituirá a versão que a igreja está vendo. Certifique-se de que os tons e links estão corretos.</p>
                 <button onClick={publishDraft} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                   <Send size={16} /> PUBLICAR TUDO AGORA
                 </button>
               </div>
               
               <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atividades Recentes</p>
                    <History size={14} className="text-slate-300" />
                  </div>
                  <div className="space-y-3">
                    {(data.logs || []).map(log => (
                      <div key={log.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4 transition-all hover:bg-white">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm"><History size={12} className="text-indigo-400" /></div>
                        <div>
                          <p className="text-[11px] font-black leading-tight"><span className="text-indigo-600 uppercase">{log.user}</span> {log.action}</p>
                          <p className="text-[9px] font-bold text-slate-300 uppercase mt-1">{log.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="p-8 border-t bg-slate-50/50 flex flex-col gap-4 items-center">
               <button onClick={() => { localStorage.removeItem('ipac_user_name'); window.location.reload(); }} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                <LogOut size={14} /> Trocar de Usuário
               </button>
               <button onClick={() => { if(confirm("Limpar cache local e recarregar?")) window.location.reload(); }} className="text-[9px] font-bold text-slate-300 hover:text-indigo-500 uppercase flex items-center gap-2">
                <RefreshCw size={10} /> Recarregar App
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Música */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-black mb-8 uppercase text-center tracking-tight text-slate-800">Novo Louvor</h3>
            <div className="space-y-4 mb-10">
              <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="Título da Música..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-indigo-500 outline-none text-sm" autoFocus />
              <input value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} placeholder="Cantor / Banda..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-indigo-500 outline-none text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddSongModal(null)} className="bg-slate-100 font-black py-4 rounded-2xl text-[10px] uppercase text-slate-400 hover:bg-slate-200 transition-colors">CANCELAR</button>
              <button onClick={addSong} className="bg-indigo-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">ADICIONAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
