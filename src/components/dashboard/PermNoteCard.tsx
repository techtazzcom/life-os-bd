import { useState } from "react";
import type { PermNote } from "@/lib/dataStore";

interface Props {
  notes: PermNote[];
  onNotesChange: (notes: PermNote[]) => void;
}

const PermNoteCard = ({ notes, onNotesChange }: Props) => {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [search, setSearch] = useState("");
  const [viewNote, setViewNote] = useState<PermNote | null>(null);

  const addNote = () => {
    if (!title || !desc) return;
    onNotesChange([{ id: Date.now(), title, desc }, ...notes]);
    setTitle(""); setDesc("");
  };

  const filtered = notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.desc.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-pink shadow-sm">
        <h3 className="font-bold text-lg text-life-pink mb-4">♾️ স্থায়ী নোট</h3>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 নোট খুঁজুন..." className="w-full px-4 py-3 rounded-2xl bg-secondary border-none outline-none text-sm font-bold mb-4 text-foreground focus:ring-2 focus:ring-life-pink/20 transition" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-life-pink-light p-4 rounded-2xl border border-life-pink/20">
          <div className="space-y-3">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="শিরোনাম..." className="w-full p-3 rounded-xl bg-card border border-border outline-none text-sm font-bold text-foreground" />
            <button onClick={addNote} className="bg-life-pink text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm w-full shadow-lg hover:opacity-90 transition active:scale-95">সংরক্ষণ</button>
          </div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-24 p-3 bg-card rounded-xl outline-none border border-border text-sm text-foreground" placeholder="বিস্তারিত..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto no-scrollbar">
          {filtered.map(n => (
            <div key={n.id} onClick={() => setViewNote(n)} className="bg-card p-4 rounded-2xl border border-border border-l-4 border-l-life-pink cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition flex justify-between items-start">
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm mb-1 text-foreground">{n.title}</h4>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{n.desc}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); onNotesChange(notes.filter(x => x.id !== n.id)); }} className="text-destructive/40 hover:text-destructive transition text-xs ml-2">🗑️</button>
            </div>
          ))}
        </div>
      </div>

      {viewNote && (
        <div className="fixed inset-0 bg-foreground/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewNote(null)}>
          <div className="bg-card rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-black text-foreground">{viewNote.title}</h3>
              <button onClick={() => setViewNote(null)} className="text-muted-foreground hover:text-destructive text-2xl">✕</button>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto no-scrollbar leading-relaxed">{viewNote.desc}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default PermNoteCard;
