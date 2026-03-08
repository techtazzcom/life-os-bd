import type { Notebook } from "@/lib/dataStore";

interface Props {
  notebooks: Notebook[];
  activeNoteId: number;
  onUpdate: (notebooks: Notebook[], activeNoteId: number) => void;
}

const DiaryCard = ({ notebooks, activeNoteId, onUpdate }: Props) => {
  const current = notebooks.find(n => n.id === activeNoteId);

  const addNote = () => {
    const name = prompt("নোটের নাম:");
    if (name) {
      const newNote = { id: Date.now(), title: name, content: '' };
      onUpdate([...notebooks, newNote], newNote.id);
    }
  };

  const deleteNote = (id: number) => {
    if (notebooks.length <= 1) return;
    const filtered = notebooks.filter(n => n.id !== id);
    onUpdate(filtered, activeNoteId === id ? filtered[0].id : activeNoteId);
  };

  const handleContentChange = (content: string) => {
    onUpdate(notebooks.map(n => n.id === activeNoteId ? { ...n, content } : n), activeNoteId);
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-purple shadow-sm">
      <h3 className="font-bold text-lg text-life-purple mb-4">✍️ প্রতিদিনের ডায়েরি</h3>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
        {notebooks.map(n => (
          <button key={n.id} onClick={() => onUpdate(notebooks, n.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition whitespace-nowrap ${n.id === activeNoteId ? 'bg-life-purple text-primary-foreground border-life-purple' : 'bg-secondary text-muted-foreground border-border hover:border-life-purple/30'}`}>
            {n.title}
            {notebooks.length > 1 && (
              <span onClick={e => { e.stopPropagation(); deleteNote(n.id); }} className="text-xs opacity-60 hover:opacity-100">✕</span>
            )}
          </button>
        ))}
        <button onClick={addNote} className="bg-life-purple text-primary-foreground w-8 h-8 rounded-lg shadow-lg transition hover:opacity-90 shrink-0">+</button>
      </div>
      <textarea value={current?.content || ''} onChange={e => handleContentChange(e.target.value)} className="w-full h-48 p-4 bg-secondary rounded-2xl outline-none border border-border text-sm font-semibold leading-relaxed text-foreground focus:border-life-purple transition resize-none" placeholder="আজকের ডায়েরি..." />
    </div>
  );
};

export default DiaryCard;
