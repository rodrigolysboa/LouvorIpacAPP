
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Music, Users, Calendar, Plus, Trash2, ExternalLink, Youtube, 
  Image as ImageIcon, ChevronDown, X, RefreshCw, Clock, Edit2, 
  Check, AlertTriangle, User, WifiOff, Cloud, ShieldCheck, 
  History, LogOut, Send, Globe, Layout
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
  
  // Admin
  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');
  const [isEditingRehearsal, setIsEditingRehearsal] = useState(false);
  const [tempRehearsal, setTempRehearsal] = useState('');

  // Modais
  const [showAddMinisterModal, setShowAddMinisterModal] = useState(false);
  const [newMinisterName, setNewMinisterName] = useState('');
  const [showAddSongModal, setShowAddSongModal] = useState<{ministerId: string} | null>(null);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');

  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFromCloud = useCallback(async (force = false) => {
    if (isSavingRef.current && !force) return;
    try {
      const res = await fetch(CLOUD_URL, { headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' } });
      if (!res.ok) throw new Error();
      const remote = await res.json();
      if (JSON.stringify(remote) !== JSON.stringify(data)) {
        setData(remote);
      }
      setSyncStatus('synced');
    } catch {
      setSyncStatus('local');
    }
  }, [data]);

  const performSave = async (updatedData: AppData) => {
    isSavingRef.current = true;
    setSyncStatus('syncing');
    try {
      await fetch(CLOUD_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body: JSON.stringify(updatedData)
      });
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
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
      draft: newDraftSchema,
      logs: [newLog, ...(data.logs || [])].slice(0, 40)
    };

    setData(updatedData);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performSave(updatedData), 1000);
  };

  useEffect(() => {
    loadFromCloud();
    const interval = setInterval(() => loadFromCloud(), 15000);
    return () => clearInterval(interval);
  }, [loadFromCloud]);

  const handleSetIdentity = () => {
    if (!tempUserName.trim()) return;
    setUserName(tempUserName.trim());
    localStorage.setItem('ipac_user_name', tempUserName.trim());
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

  // Funções de Edição (Somente no Draft)
  const addSong = () => {
    if (!newSongTitle.trim() || !newSongArtist.trim() || !showAddSongModal) return;
    const newSong: Song = { id: generateId(), title: newSongTitle.trim(), artist: newSongArtist.trim(), key: MusicKey.ORIGINAL };
    const newMinisters = data.draft.ministers.map(m => 
      m.id === showAddSongModal.ministerId ? { ...m, songs: [...m.songs, newSong] } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Adicionou "${newSong.title}"`);
    setShowAddSongModal(null); setNewSongTitle(''); setNewSongArtist('');
  };

  const updateSong = (mId: string, sId: string, up: Partial<Song>) => {
    const newMinisters = data.draft.ministers.map(m => 
      m.id === mId ? { ...m, songs: m.songs.map(s => s.id === sId ? { ...s, ...up } : s) } : m
    );
    // Debounce maior para edição de texto
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Editou dados de música`);
  };

  const deleteSong = (mId: string, sId: string) => {
    const newMinisters = data.draft.ministers.map(m => 
      m.id === mId ? { ...m, songs: m.songs.filter(s => s.id !== sId) } : m
    );
    triggerDraftUpdate({ ...data.draft, ministers: newMinisters }, `Removeu uma música`);
  };

  const publishDraft = () => {
    const publishedData: AppData = {
      ...data,
      published: data.draft,
      logs: [{ id: generateId(), user: userName, action: 'PUBLICOU TODAS AS ALTERAÇÕES', timestamp: new Date().toLocaleTimeString() }, ...data.logs]
    };
    setData(publishedData);
    performSave(publishedData);
    setIsAdminOpen(false);
    setViewMode('public');
    alert('Publicado com sucesso! Agora todos verão as atualizações.');
  };

  const currentSchema = viewMode === 'public' ? data.published : data.draft;

  return (
    <div className="min-h-screen pb-24 bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Tarja de Modo de Visão */}
      <div className={`py-2 px-4 text-center text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${viewMode === 'public' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
        {viewMode === 'public' ? (
          <span className="flex items-center justify-center gap-2"><Globe size={12} /> Versão Oficial (Mural da Igreja)</span>
        ) : (
          <span className="flex items-center justify-center gap-2 animate-pulse"><Edit2 size={12} /> Modo Edição (Rascunho)</span>
        )}
      </div>

      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleLogoClick}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><Music size={22} /></div>
            <h1 className="text-xl font-brand font-black tracking-tighter uppercase">IPAC <span className="text-indigo-600">Louvor</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewMode(v => v === 'public' ? 'editor' : 'public')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${viewMode === 'editor' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}
            >
              {viewMode === 'editor' ? <Layout size={14} /> : <Edit2 size={14} />}
              {viewMode === 'editor' ? 'SAIR DA EDIÇÃO' : 'EDITAR LISTA'}
            </button>
            {syncStatus === 'syncing' && <RefreshCw size={16} className="animate-spin text-amber-500" />}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 mb-8 max-w-[280px] mx-auto">
          <button onClick={() => setActiveTab('songs')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${activeTab === 'songs' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>MÚSICAS</button>
          <button onClick={() => setActiveTab('scale')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${activeTab === 'scale' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>ESCALA</button>
        </div>

        {activeTab === 'songs' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentSchema?.ministers?.map((m) => (
              <div key={m.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">{m.name}</h3>
                  <span className="bg-slate-50 text-slate-400 text-[9px] font-black px-3 py-1 rounded-full uppercase">{m.songs?.length || 0} Louvores</span>
                </div>
                
                <div className="space-y-3">
                  {m.songs?.map((s) => (
                    <div key={s.id} className="bg-slate-50/50 rounded-3xl p-4 border border-slate-100 group">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <input 
                            readOnly={viewMode === 'public'}
                            value={s.title} 
                            onChange={(e) => updateSong(m.id, s.id, { title: e.target.value })}
                            className="bg-transparent border-none font-black text-slate-900 text-sm focus:ring-0 p-0 block w-full"
                          />
                          <input 
                            readOnly={viewMode === 'public'}
                            value={s.artist} 
                            onChange={(e) => updateSong(m.id, s.id, { artist: e.target.value })}
                            className="bg-transparent border-none font-bold text-slate-400 text-[10px] uppercase focus:ring-0 p-0 block w-full"
                          />
                        </div>
                        {viewMode === 'editor' && (
                          <button onClick={() => deleteSong(m.id, s.id)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <select 
                            disabled={viewMode === 'public'}
                            value={s.key} 
                            onChange={(e) => updateSong(m.id, s.id, { key: e.target.value as MusicKey })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase appearance-none focus:border-indigo-500 focus:ring-0"
                          >
                            {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        {s.youtubeLink || viewMode === 'editor' ? (
                          <div className="flex-1 flex gap-2">
                             <input 
                               readOnly={viewMode === 'public'}
                               placeholder="Youtube URL"
                               value={s.youtubeLink || ''}
                               onChange={(e) => updateSong(m.id, s.id, { youtubeLink: e.target.value })}
                               className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold focus:ring-0"
                             />
                             {s.youtubeLink && <a href={s.youtubeLink} target="_blank" className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Youtube size={14} /></a>}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  
                  {viewMode === 'editor' && (
                    <button 
                      onClick={() => setShowAddSongModal({ ministerId: m.id })}
                      className="w-full py-4 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 font-black text-[10px] uppercase hover:bg-slate-50 hover:border-indigo-100 hover:text-indigo-400 transition-all"
                    >
                      + Adicionar Música
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
             <ImageIcon size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Aba de Escalas em breve</p>
          </div>
        )}
      </main>

      {/* MODAL: IDENTIDADE */}
      {isIdentityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 text-center animate-in zoom-in-95">
            <User className="text-indigo-600 mx-auto mb-6" size={48} />
            <h3 className="text-2xl font-black mb-2 tracking-tight">Quem está entrando?</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase mb-10">Digite seu nome para começar</p>
            <input 
              value={tempUserName} onChange={e => setTempUserName(e.target.value)} 
              placeholder="Ex: Alisson Santos"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-center font-black focus:border-indigo-500 focus:outline-none mb-8"
              autoFocus onKeyDown={e => e.key === 'Enter' && handleSetIdentity()}
            />
            <button onClick={handleSetIdentity} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase text-xs tracking-widest">ACESSAR PAINEL</button>
          </div>
        </div>
      )}

      {/* PAINEL ADMIN SEGRETO */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-tight flex items-center gap-3"><ShieldCheck className="text-indigo-600" /> Aprovação de Mudanças</h3>
              <button onClick={() => setIsAdminOpen(false)}><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               <button onClick={publishDraft} className="w-full bg-emerald-500 text-white p-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-emerald-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 mb-6">
                 <Send size={18} /> PUBLICAR TUDO AGORA
               </button>
               <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Atividades Recentes</p>
                  {data.logs?.map(log => (
                    <div key={log.id} className="bg-slate-50 p-4 rounded-2xl border flex items-center gap-4">
                      <div className="bg-white p-2 rounded-lg border shadow-sm"><History size={14} className="text-indigo-400" /></div>
                      <div>
                        <p className="text-xs font-black"><span className="text-indigo-600">{log.user}</span> {log.action}</p>
                        <p className="text-[9px] font-bold text-slate-400">{log.timestamp}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 animate-in zoom-in-95">
            <h3 className="text-xl font-black mb-8 uppercase text-center tracking-tight">Novo Louvor</h3>
            <div className="space-y-4 mb-10">
              <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="Título..." className="w-full bg-slate-50 border-2 rounded-2xl p-4 font-bold focus:border-indigo-500 outline-none" />
              <input value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} placeholder="Cantor..." className="w-full bg-slate-50 border-2 rounded-2xl p-4 font-bold focus:border-indigo-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddSongModal(null)} className="bg-slate-100 font-black py-4 rounded-2xl text-[10px] uppercase">CANCELAR</button>
              <button onClick={addSong} className="bg-indigo-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg shadow-indigo-100">ADICIONAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
