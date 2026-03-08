import { useState } from "react";
import type { Notebook } from "@/lib/dataStore";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  notebooks: Notebook[];
  activeNoteId: number;
  onUpdate: (notebooks: Notebook[], activeNoteId: number) => void;
}

const DiaryCard = ({ notebooks, activeNoteId, onUpdate }: Props) => {
  const current = notebooks.find(n => n.id === activeNoteId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const addNote = () => {
    if (!newNoteName.trim()) return;
    const newNote = { id: Date.now(), title: newNoteName.trim(), content: '' };
    onUpdate([...notebooks, newNote], newNote.id);
    setNewNoteName("");
    setShowAddDialog(false);
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
              <span onClick={e => { e.stopPropagation(); setDeleteId(n.id); }} className="text-xs opacity-60 hover:opacity-100">✕</span>
            )}
          </button>
        ))}
        <button onClick={() => setShowAddDialog(true)} className="bg-life-purple text-primary-foreground w-8 h-8 rounded-lg shadow-lg transition hover:opacity-90 shrink-0">+</button>
      </div>
      <textarea value={current?.content || ''} onChange={e => handleContentChange(e.target.value)} className="w-full h-48 p-4 bg-secondary rounded-2xl outline-none border border-border text-sm font-semibold leading-relaxed text-foreground focus:border-life-purple transition resize-none" placeholder="আজকের ডায়েরি..." />

      {/* Add Note Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">📝 নতুন নোট</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={newNoteName}
            onChange={e => setNewNoteName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder="নোটের নাম লিখুন..."
            className="w-full p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground focus:border-life-purple transition"
            autoFocus
          />
          <DialogFooter>
            <button onClick={() => setShowAddDialog(false)} className="px-4 py-2.5 rounded-xl font-bold text-sm border border-border text-foreground hover:bg-secondary transition">বাতিল</button>
            <button onClick={addNote} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-life-purple text-primary-foreground hover:opacity-90 transition">যুক্ত করুন</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null && notebooks.length > 1) {
            const filtered = notebooks.filter(n => n.id !== deleteId);
            onUpdate(filtered, activeNoteId === deleteId ? filtered[0].id : activeNoteId);
            setDeleteId(null);
          }
        }}
        title="নোটটি ডিলেট করবেন?"
        description="এই নোট এবং এর সমস্ত লেখা মুছে ফেলা হবে।"
      />
    </div>
  );
};

export default DiaryCard;
