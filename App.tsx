
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Music, Users, Calendar, Plus, Trash2, ExternalLink, Youtube, 
  Image as ImageIcon, ChevronDown, X, RefreshCw, Clock, Edit2, 
  Check, AlertTriangle, User, WifiOff, Cloud, ShieldCheck, 
  History, LogOut, Send, Globe, Layout, RotateCcw
} from 'lucide-react';
import { AppData, Minister, Song, MusicKey, Schema, AuditLog } from './types';
import { STORAGE_KEY, INITIAL_DATA, MUSIC_KEYS } from './constants';

const BIN_ID = '67c06283e41b4d34e4a0593b'; 
const API_KEY = '$2a$10$W2zW.m/u8S/mO7xP/eF.i.7U9N8N0R8S.9Z.O.O.O.O.O.O.O.O'; 
const CLOUD_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const generateId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'songs' | 'scale'>('songs');
  const [viewMode, setViewMode] = useState<'public' | 'editor'>('public');
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('ipac_user_name') || '');
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(!userName);
  const [tempUserName, setTempUserName] = useState('');
  
  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Estado inicial garantido para evitar undefined crashes
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');
  const [isLoading, setIsLoading] = useState(true);

  // Modais
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
        headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false', 'Cache-Control': 'no-cache' } 
      });
      
      if (res.status === 404) {
        // Se o bin não existir, inicializamos ele
        await performSave(INITIAL_DATA);
        return;
      }

      if (!res.ok) throw new Error('Falha na resposta do servidor');
      
      const remote = await res.json();
      
      // Validação básica do esquema recebido
      if (remote && remote.published && remote.draft) {
        setData(remote);
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Erro de conexão:', err);
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
    } catch (err) {
      setSyncStatus('error');
      console.error('Erro ao salvar:', err);
    } finally {
      isSavingRef.current = false;
    }
  };

  const triggerDraftUpdate = (newDraftSchema: Schema, action: string) => {
    const newLog: AuditLog = {
      id: generateId(),
      user: userName || 'Membro IPAC',
      action: action,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    };
    
    const updatedData: AppData = {
      ...data,
      draft: {
        ...data.draft,
        ...newDraftSchema
      },
      logs: [newLog, ...(data.logs || [])].slice(0, 30)
    };

    setData(updatedData);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performSave(updatedData), 1500);
  };

  useEffect(() => {
    loadFromCloud();
    const interval = setInterval(loadFromCloud, 20000); // Poll a cada 20s
    return () => clearInterval(interval);
  }, [loadFromCloud]);

  const handleSetIdentity = () => {
    if (!tempUserName.trim()) return;
    const name = tempUserName.trim();
    setUserName(name);
    localStorage.setItem('ipac_user_name', name);
    setIsIdentityModalOpen(false);
  };

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next === 5) {
        setIsAdminOpen(true);
        return 0;
      }
      return next;
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
    const newMinisters = (data.draft?.ministers || []).map(m => 
      m.id === showAddSongModal.ministerId ? { ...m, songs: [...(m.songs || []), newSong] } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Adicionou "${newSong.title}"`);
    setShowAddSongModal(null); setNewSongTitle(''); setNewSongArtist('');
  };

  const updateSong = (mId: string, sId: string, up: Partial<Song>) => {
    const newMinisters = (data.draft?.ministers || []).map(m => 
      m.id === mId ? { ...m, songs: (m.songs || []).map(s => s.id === sId ? { ...s, ...up } : s) } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Alterou música`);
  };

  const deleteSong = (mId: string, sId: string) => {
    const newMinisters = (data.draft?.ministers || []).map(m => 
      m.id === mId ? { ...m, songs: (m.songs || []).filter(s => s.id !== sId) } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Removeu música`);
  };

  const publishDraft = () => {
    const publishedData: AppData = {
      ...data,
      published: JSON.parse(JSON.stringify(data.draft)),
      logs: [{ 
        id: generateId(), 
        user: userName, 
        action: 'PUBLICOU MUDANÇAS OFICIAIS', 
        timestamp: new Date().toLocaleTimeString() 
      }, ...data.logs]
    };
    setData(publishedData);
    performSave(publishedData);
    setIsAdminOpen(false);
    setViewMode('public');
    alert('Publicado com sucesso!');
  };

  const resetAll = () => {
    if (window.confirm("Deseja realmente apagar tudo e voltar ao início?")) {
      setData(INITIAL_DATA);
      performSave(INITIAL_DATA);
      setIsAdminOpen(false);
    }
  };

  // Prevenção de crash: Fallback caso data não esteja pronto
  const safeData = data || INITIAL_DATA;
  const currentSchema = viewMode === 'public' ? safeData.published : safeData.draft;

  if (isLoading && syncStatus === 'local') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <RefreshCw className="text-indigo-600 animate-spin mb-4" size={40} />
        <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Conectando ao Louvor IPAC...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      <div className={`py-2 px-4 text-center text-[10px] font-black uppercase tracking-[0.2em] shadow-inner transition-colors ${viewMode === 'public' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
        {viewMode === 'public' ? '● Versão Oficial IPAC' : '⚠ MODO EDIÇÃO ATIVO'}
      </div>

      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer select-none active:scale-95 transition-transform" onClick={handleLogoClick}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><Music size={22} /></div>
            <h1 className="text-xl font-brand font-black tracking-tighter uppercase">IPAC <span className="text-indigo-600">Louvor</span></h1>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
              onClick={() => setViewMode(v => v === 'public' ? 'editor' : 'public')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black border-2 transition-all ${viewMode === 'editor' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-500'}`}
            >
              {viewMode === 'editor' ? <X size={14} /> : <Edit2 size={14} />}
              {viewMode === 'editor' ? 'FECHAR EDIÇÃO' : 'EDITAR'}
            </button>
            {syncStatus === 'syncing' ? (
              <div className="bg-amber-50 p-2 rounded-full"><RefreshCw size={14} className="animate-spin text-amber-500" /></div>
            ) : syncStatus === 'error' ? (
              <button onClick={loadFromCloud} className="bg-red-500 text-white p-2 rounded-full animate-bounce"><WifiOff size={14} /></button>
            ) : (
              <div className="bg-emerald-50 p-2 rounded-full"><Cloud size={14} className="text-emerald-500" /></div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 mb-8 max-w-[280px] mx-auto">
          <button onClick={() => setActiveTab('songs')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'songs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>MÚSICAS</button>
          <button onClick={() => setActiveTab('scale')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black transition-all ${activeTab === 'scale' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ESCALA</button>
        </div>

        {activeTab === 'songs' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {(currentSchema?.ministers || []).map((m) => (
              <div key={m.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 flex flex-col hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between border-b border-slate-50 pb-5 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><User size={16} /></div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">{m.name}</h3>
                  </div>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{m.songs?.length || 0} Itens</span>
                </div>
                
                <div className="space-y-4 flex-1">
                  {(m.songs || []).map((s) => (
                    <div key={s.id} className="bg-slate-50/50 rounded-[1.8rem] p-5 border border-slate-100 group relative">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <input 
                            readOnly={viewMode === 'public'}
                            value={s.title} 
                            onChange={(e) => updateSong(m.id, s.id, { title: e.target.value })}
                            className="bg-transparent border-none font-black text-slate-900 text-sm focus:ring-0 p-0 block w-full truncate placeholder:text-slate-300"
                            placeholder="Nome do Louvor"
                          />
                          <input 
                            readOnly={viewMode === 'public'}
                            value={s.artist} 
                            onChange={(e) => updateSong(m.id, s.id, { artist: e.target.value })}
                            className="bg-transparent border-none font-bold text-slate-400 text-[10px] uppercase focus:ring-0 p-0 block w-full truncate placeholder:text-slate-200"
                            placeholder="Cantor / Banda"
                          />
                        </div>
                        {viewMode === 'editor' && (
                          <button onClick={() => deleteSong(m.id, s.id)} className="text-slate-200 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <select 
                            disabled={viewMode === 'public'}
                            value={s.key || MusicKey.ORIGINAL} 
                            onChange={(e) => updateSong(m.id, s.id, { key: e.target.value as MusicKey })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-black uppercase appearance-none focus:border-indigo-500 focus:ring-0 shadow-sm"
                          >
                            {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          <ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                        
                        {(s.youtubeLink || viewMode === 'editor') && (
                          <div className="flex-[1.5] flex gap-2">
                             <input 
                               readOnly={viewMode === 'public'}
                               placeholder="Youtube Link"
                               value={s.youtubeLink || ''}
                               onChange={(e) => updateSong(m.id, s.id, { youtubeLink: e.target.value })}
                               className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-bold focus:ring-0 shadow-sm truncate"
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
                      className="w-full py-5 border-2 border-dashed border-slate-100 rounded-[1.8rem] text-slate-300 font-black text-[9px] uppercase hover:bg-slate-50 hover:border-indigo-100 hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> NOVO LOUVOR
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
             <ImageIcon size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Escalas em manutenção</p>
          </div>
        )}
      </main>

      {/* MODAL: IDENTIDADE */}
      {isIdentityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6"><User className="text-indigo-600" size={32} /></div>
            <h3 className="text-xl font-black mb-2 tracking-tight">Quem está entrando?</h3>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-10">Identifique-se para começar</p>
            <input 
              value={tempUserName} onChange={e => setTempUserName(e.target.value)} 
              placeholder="Digite seu nome..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center font-black focus:border-indigo-500 focus:outline-none mb-8"
              autoFocus onKeyDown={e => e.key === 'Enter' && handleSetIdentity()}
            />
            <button onClick={handleSetIdentity} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase text-[10px] tracking-widest">ENTRAR AGORA</button>
          </div>
        </div>
      )}

      {/* PAINEL ADMIN SEGRETO */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-indigo-600" />
                <h3 className="font-black uppercase tracking-tight text-sm">Controle IPAC</h3>
              </div>
              <button onClick={() => setIsAdminOpen(false)} className="text-slate-300 hover:text-slate-900"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
               <button onClick={publishDraft} className="w-full bg-emerald-500 text-white p-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-emerald-100 hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                 <Send size={16} /> PUBLICAR MUDANÇAS PARA TODOS
               </button>
               
               <button onClick={resetAll} className="w-full bg-white border-2 border-slate-100 text-slate-400 p-4 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center gap-3">
                 <RotateCcw size={14} /> RESETAR BANCO DE DADOS
               </button>

               <div className="space-y-3 pt-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Registro de Atividade</p>
                  {(data.logs || []).map(log => (
                    <div key={log.id} className="bg-slate-50 p-4 rounded-2xl border flex items-center gap-4">
                      <div className="bg-white p-2 rounded-lg border shadow-sm"><History size={14} className="text-indigo-400" /></div>
                      <div>
                        <p className="text-[11px] font-black leading-tight"><span className="text-indigo-600">{log.user}</span> {log.action}</p>
                        <p className="text-[9px] font-bold text-slate-400">{log.timestamp}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
            <div className="p-6 bg-slate-50 border-t flex justify-center">
               <button onClick={() => { localStorage.removeItem('ipac_user_name'); window.location.reload(); }} className="text-[9px] font-black text-slate-300 hover:text-red-500 uppercase tracking-widest flex items-center gap-2">
                <LogOut size={12} /> Trocar Usuário
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-black mb-8 uppercase text-center tracking-tight">Novo Louvor</h3>
            <div className="space-y-4 mb-10">
              <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="Título da Música..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-indigo-500 outline-none text-sm" autoFocus />
              <input value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} placeholder="Cantor / Banda..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-indigo-500 outline-none text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddSongModal(null)} className="bg-slate-100 font-black py-4 rounded-2xl text-[10px] uppercase text-slate-500">CANCELAR</button>
              <button onClick={addSong} className="bg-indigo-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg shadow-indigo-100">ADICIONAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
