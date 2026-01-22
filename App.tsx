
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
  ShieldCheck,
  History,
  LogOut,
  RotateCcw
} from 'lucide-react';
import { AppData, Minister, Song, MusicKey, ScaleImage, AuditLog } from './types';
import { STORAGE_KEY, INITIAL_DATA, MUSIC_KEYS } from './constants';

const BIN_ID = '67c06283e41b4d34e4a0593b'; 
const API_KEY = '$2a$10$W2zW.m/u8S/mO7xP/eF.i.7U9N8N0R8S.9Z.O.O.O.O.O.O.O.O'; 
const CLOUD_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'songs' | 'scale'>('songs');
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('ipac_user_name') || '');
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(!userName);
  const [tempUserName, setTempUserName] = useState('');
  
  // Painel Admin Secreto
  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');
  const [isEditingRehearsal, setIsEditingRehearsal] = useState(false);
  const [tempRehearsal, setTempRehearsal] = useState('');

  // Modais de Edição
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
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SINC: Carregar
  const loadFromCloud = useCallback(async (force = false) => {
    if ((isSavingRef.current || isEditingRehearsal) && !force) return;
    try {
      const res = await fetch(CLOUD_URL, { headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' } });
      if (!res.ok) throw new Error();
      const remote = await res.json();
      if (JSON.stringify(remote) !== JSON.stringify(data)) {
        setData(remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      }
      setSyncStatus('synced');
    } catch {
      setSyncStatus('local');
    }
  }, [data, isEditingRehearsal]);

  // SINC: Salvar
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
    } catch {
      setSyncStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  };

  const triggerUpdate = (newData: AppData, actionDescription: string) => {
    const newLog: AuditLog = {
      id: generateId(),
      user: userName || 'Anônimo',
      action: actionDescription,
      timestamp: new Date().toLocaleString('pt-BR')
    };
    
    const finalData = {
      ...newData,
      logs: [newLog, ...(newData.logs || [])].slice(0, 50) // Mantém os últimos 50 logs
    };

    setData(finalData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalData));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performSave(finalData), 1500);
  };

  useEffect(() => {
    loadFromCloud();
    const interval = setInterval(() => loadFromCloud(), 12000);
    return () => clearInterval(interval);
  }, [loadFromCloud]);

  // Handlers
  const handleSetIdentity = () => {
    if (!tempUserName.trim()) return;
    const name = tempUserName.trim();
    setUserName(name);
    localStorage.setItem('ipac_user_name', name);
    setIsIdentityModalOpen(false);
  };

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);
    if (newCount === 5) {
      setIsAdminOpen(true);
      setLogoClicks(0);
    }
    setTimeout(() => setLogoClicks(0), 3000); // Resetar contador após 3s
  };

  const handleAddMinister = () => {
    if (!newMinisterName.trim()) return;
    const newM: Minister = { id: generateId(), name: newMinisterName.trim(), songs: [] };
    triggerUpdate({ ...data, ministers: [...data.ministers, newM] }, `Adicionou o ministro ${newM.name}`);
    setNewMinisterName('');
    setShowAddMinisterModal(false);
  };

  const askDeleteMinister = (id: string, name: string) => {
    setConfirmModal({
      show: true,
      title: 'Remover Bloco',
      message: `Isso apagará o bloco de ${name}. Confirmar?`,
      onConfirm: () => {
        triggerUpdate({ ...data, ministers: data.ministers.filter(m => m.id !== id) }, `Removeu o ministro ${name}`);
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleAddSong = () => {
    if (!newSongTitle.trim() || !newSongArtist.trim() || !showAddSongModal) return;
    const newS: Song = { id: generateId(), title: newSongTitle.trim(), artist: newSongArtist.trim(), key: MusicKey.ORIGINAL, youtubeLink: '' };
    const updated = data.ministers.map(m => m.id === showAddSongModal.ministerId ? { ...m, songs: [...m.songs, newS] } : m);
    triggerUpdate({ ...data, ministers: updated }, `Adicionou a música "${newS.title}"`);
    setNewSongTitle(''); setNewSongArtist(''); setShowAddSongModal(null);
  };

  const updateSong = (mId: string, sId: string, up: Partial<Song>) => {
    const mName = data.ministers.find(m => m.id === mId)?.name;
    const sName = data.ministers.find(m => m.id === mId)?.songs.find(s => s.id === sId)?.title;
    const updated = data.ministers.map(m => m.id === mId ? { ...m, songs: m.songs.map(s => s.id === sId ? { ...s, ...up } : s) } : m);
    // Log reduzido para não saturar com cada letra digitada (debounce natural do triggerUpdate já ajuda)
    triggerUpdate(updated, `Editou a música "${sName}" do bloco de ${mName}`);
  };

  const deleteSong = (mId: string, sId: string) => {
    const sName = data.ministers.find(m => m.id === mId)?.songs.find(s => s.id === sId)?.title;
    const updated = data.ministers.map(m => m.id === mId ? { ...m, songs: m.songs.filter(s => s.id !== sId) } : m);
    triggerUpdate(updated, `Removeu a música "${sName}"`);
  };

  // Fix: Added missing saveRehearsalInfo function to persist agenda updates
  const saveRehearsalInfo = () => {
    triggerUpdate({ ...data, rehearsalInfo: tempRehearsal }, 'Editou as informações de ensaio/agenda');
    setIsEditingRehearsal(false);
  };

  const resetGlobal = () => {
    if (confirm('ATENÇÃO: Isso restaurará o banco para o estado original da IPAC. Todos os louvores atuais serão perdidos. Continuar?')) {
      triggerUpdate(INITIAL_DATA, 'REALIZOU UM RESET GLOBAL NO SISTEMA');
      setIsAdminOpen(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer select-none active:scale-95 transition-transform" onClick={handleLogoClick}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <Music size={22} />
            </div>
            <h1 className="text-xl md:text-2xl font-brand font-black text-slate-900 tracking-tighter uppercase">
              Louvor <span className="text-indigo-600">Ipac</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acesso de</span>
              <span className="text-[11px] font-black text-indigo-600 uppercase">{userName || 'Visitante'}</span>
            </div>
            {syncStatus === 'syncing' ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-600 p-2 rounded-full animate-spin"><RefreshCw size={14} /></div>
            ) : syncStatus === 'synced' ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-2 rounded-full"><Cloud size={14} /></div>
            ) : (
              <button onClick={() => performSave(data)} className="bg-red-500 text-white p-2 rounded-full shadow-lg animate-bounce"><WifiOff size={14} /></button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-200 mb-10 max-w-[280px] mx-auto overflow-hidden">
          <button onClick={() => setActiveTab('songs')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeTab === 'songs' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
            <Music size={14} /> MÚSICAS
          </button>
          <button onClick={() => setActiveTab('scale')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeTab === 'scale' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
            <Calendar size={14} /> ESCALA
          </button>
        </div>

        {activeTab === 'songs' ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <Users className="text-indigo-600" size={20} /> Ministros
              </h2>
              <button onClick={() => setShowAddMinisterModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95"><Plus size={20} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {data.ministers.map((m) => (
                <MinisterCard 
                  key={m.id} 
                  minister={m}
                  onDelete={() => askDeleteMinister(m.id, m.name)}
                  onAddSong={() => setShowAddSongModal({ ministerId: m.id })}
                  onUpdateSong={(sId, up) => updateSong(m.id, sId, up)}
                  onDeleteSong={(sId) => deleteSong(m.id, sId)}
                />
              ))}
            </div>
            
            {/* Bloco de Avisos */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 mt-20 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <Clock size={14} className="text-indigo-600" /> Agenda IPAC
                </div>
                <button onClick={() => { if (isEditingRehearsal) saveRehearsalInfo(); else { setTempRehearsal(data.rehearsalInfo); setIsEditingRehearsal(true); } }} className="p-2 hover:bg-slate-50 rounded-full transition-all">
                  {isEditingRehearsal ? <Check size={20} className="text-emerald-500" /> : <Edit2 size={14} className="text-slate-300" />}
                </button>
              </div>
              {isEditingRehearsal ? (
                <textarea value={tempRehearsal} onChange={(e) => setTempRehearsal(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-indigo-500 min-h-[150px]" autoFocus />
              ) : (
                <p className="text-sm font-bold text-slate-600 whitespace-pre-line leading-relaxed">{data.rehearsalInfo}</p>
              )}
              <div className="mt-6 flex items-center gap-3 bg-red-50 p-4 rounded-2xl border border-red-100">
                <AlertTriangle className="text-red-500" size={18} />
                <p className="text-[10px] font-black text-red-700 uppercase tracking-tight">Proibido atrasos acima de 10 min. Avisar no grupo se houver imprevistos!</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
             <ImageIcon size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Nenhuma escala postada.</p>
          </div>
        )}
      </main>

      {/* MODAL: IDENTIDADE (OBRIGATÓRIO) */}
      {isIdentityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-inner">
              <User className="text-indigo-600" size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tighter">Quem está acessando?</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">Para registrar quem fez cada mudança</p>
            <input 
              type="text" 
              value={tempUserName}
              onChange={(e) => setTempUserName(e.target.value)}
              placeholder="Digite seu nome..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-800 font-black focus:border-indigo-500 focus:bg-white focus:outline-none mb-10 text-center"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSetIdentity()}
            />
            <button onClick={handleSetIdentity} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all uppercase tracking-widest text-[11px]">ENTRAR NO APP</button>
          </div>
        </div>
      )}

      {/* PAINEL ADMIN SEGRETO */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-top-10">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-indigo-600" size={24} />
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Painel de Auditoria</h3>
              </div>
              <button onClick={() => setIsAdminOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 mb-6">
                <RotateCcw className="text-amber-600" size={20} />
                <p className="text-xs font-bold text-amber-700">Controle de Segurança: Use o reset apenas se o banco de dados for corrompido ou precisar limpar tudo.</p>
                <button onClick={resetGlobal} className="ml-auto bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-amber-700">RESET GLOBAL</button>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Histórico Recente de Ações</h4>
                {(data.logs || []).map((log) => (
                  <div key={log.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-4">
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm"><History size={14} className="text-indigo-400" /></div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight"><span className="text-indigo-600">{log.user}</span> {log.action}</p>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 border-top border-slate-100 text-center">
              <button onClick={() => { localStorage.removeItem('ipac_user_name'); window.location.reload(); }} className="text-[10px] font-black text-slate-400 hover:text-red-500 flex items-center justify-center gap-2 mx-auto uppercase tracking-widest">
                <LogOut size={12} /> Deslogar meu usuário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO MINISTRO */}
      {showAddMinisterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 text-center mb-1 tracking-tight uppercase">Novo Ministro</h3>
            <p className="text-slate-400 text-center text-[10px] mb-8 font-black uppercase tracking-widest">Criar novo bloco de louvor</p>
            <input type="text" value={newMinisterName} onChange={(e) => setNewMinisterName(e.target.value)} placeholder="Nome do Ministro..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-800 font-bold focus:border-indigo-500 focus:outline-none mb-8" autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddMinisterModal(false)} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 uppercase tracking-widest text-[10px]">SAIR</button>
              <button onClick={handleAddMinister} className="bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-lg uppercase tracking-widest text-[10px]">CRIAR</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 text-center mb-8 tracking-tight uppercase">Novo Louvor</h3>
            <div className="space-y-6 mb-10">
              <input type="text" value={newSongTitle} onChange={(e) => setNewSongTitle(e.target.value)} placeholder="Título da Música..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-800 font-bold focus:border-indigo-500 focus:outline-none shadow-sm" autoFocus />
              <input type="text" value={newSongArtist} onChange={(e) => setNewSongArtist(e.target.value)} placeholder="Cantor / Banda..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-800 font-bold focus:border-indigo-500 focus:outline-none shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowAddSongModal(null)} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 uppercase tracking-widest text-[10px]">FECHAR</button>
              <button onClick={handleAddSong} disabled={!newSongTitle.trim() || !newSongArtist.trim()} className={`text-white font-black py-4 rounded-2xl shadow-lg transition-all uppercase tracking-widest text-[10px] ${(!newSongTitle.trim() || !newSongArtist.trim()) ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>ADICIONAR</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-10 text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle className="text-red-500" size={32} /></div>
             <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">{confirmModal.title}</h3>
             <p className="text-slate-500 text-sm mb-10 font-bold">{confirmModal.message}</p>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setConfirmModal(prev => ({...prev, show: false}))} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]">PARAR</button>
                <button onClick={confirmModal.onConfirm} className="bg-red-500 text-white font-black py-4 rounded-2xl shadow-lg uppercase tracking-widest text-[10px]">REMOVER</button>
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
    <div className="bg-white rounded-[3rem] shadow-md border border-slate-100 flex flex-col hover:shadow-2xl transition-all duration-500 h-full group">
      <div className="bg-slate-50/80 p-7 border-b border-slate-100 flex justify-between items-center relative overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-1.5 bg-indigo-600" />
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Users size={18} /></div>
          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{minister.name}</h3>
        </div>
        <button onClick={onDelete} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><X size={24} /></button>
      </div>

      <div className="p-7 flex-1 space-y-6">
        {minister.songs.length === 0 ? (
          <div className="py-12 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.4em] bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">Vazio</div>
        ) : (
          minister.songs.map((s) => (
            <div key={s.id} className="bg-slate-50/80 border-2 border-slate-100 rounded-[2.2rem] p-6 space-y-5 hover:border-indigo-400 hover:bg-white transition-all duration-300 relative group/song">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-1.5">
                  <input type="text" value={s.title} onChange={(e) => onUpdateSong(s.id, { title: e.target.value })} className="bg-transparent border-none font-black text-slate-900 focus:ring-0 p-0 text-[17px] w-full placeholder:text-slate-300" placeholder="Música..." />
                  <div className="flex items-center gap-2 text-slate-400">
                    <User size={14} className="text-indigo-500" />
                    <input type="text" value={s.artist} onChange={(e) => onUpdateSong(s.id, { artist: e.target.value })} className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest focus:ring-0 p-0 w-full placeholder:text-slate-300" placeholder="Cantor..." />
                  </div>
                </div>
                <button onClick={() => onDeleteSong(s.id)} className="text-slate-200 hover:text-red-400 opacity-0 group-hover/song:opacity-100 p-1"><Trash2 size={16} /></button>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[120px]">
                   <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-2 mb-2 block">Tom Vocal</label>
                   <div className="relative">
                    <select value={s.key} onChange={(e) => onUpdateSong(s.id, { key: e.target.value as MusicKey })} className="w-full appearance-none bg-white border-2 border-slate-200 text-slate-800 text-[10px] font-black rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-0 cursor-pointer uppercase shadow-sm">
                      {MUSIC_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                   </div>
                </div>
                <div className="flex-1 min-w-[160px] relative">
                  <label className="text-[9px] font-black text-red-600 uppercase tracking-widest ml-2 mb-2 block">Link / Youtube</label>
                  <div className="relative">
                    <input type="text" value={s.youtubeLink} onChange={(e) => onUpdateSong(s.id, { youtubeLink: e.target.value })} className="w-full text-[10px] font-black bg-white border-2 border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:border-red-500 shadow-sm" placeholder="Youtube..." />
                    <Youtube size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                    {s.youtubeLink && (
                      <a href={s.youtubeLink.startsWith('http') ? s.youtubeLink : `https://youtube.com/results?search_query=${s.title}`} target="_blank" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors"><ExternalLink size={14} /></a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-7 pt-0">
        <button onClick={onAddSong} className="w-full py-5 border-2 border-dashed border-indigo-100 rounded-[2rem] text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><Plus size={18} /> NOVO LOUVOR</button>
      </div>
    </div>
  );
};

export default App;
