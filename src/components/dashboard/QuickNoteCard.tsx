import { Trash2 } from "lucide-react";

interface Props {
  notes: string[];
  onNotesChange: (notes: string[]) => void;
}

const QuickNoteCard = ({ notes, onNotesChange }: Props) => {
  const updateNote = (index: number, val: string) => {
    const updated = [...notes];
    updated[index] = val;
    onNotesChange(updated);
  };

  const deleteNote = (index: number) => {
    if (notes.length <= 1) return;
    onNotesChange(notes.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-yellow shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-life-yellow text-sm uppercase flex items-center gap-2">📝 কুইক নোট</h3>
        <button onClick={() => onNotesChange([...notes, ""])} className="bg-life-yellow-light text-life-yellow w-6 h-6 rounded-full flex items-center justify-center text-xs hover:opacity-80 transition">+</button>
      </div>
      <div className="space-y-3">
        {notes.map((note, i) => (
          <div key={i} className="relative">
            <textarea value={note} onChange={e => updateNote(i, e.target.value)} className="w-full h-20 p-3 bg-secondary border border-border rounded-xl outline-none resize-none text-sm font-semibold text-foreground focus:border-life-yellow transition" placeholder="এখানে কিছু লিখে রাখুন..." />
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button onClick={() => { const u = [...notes]; u[i] = ''; onNotesChange(u); }} className="text-[10px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded transition opacity-50 hover:opacity-100">Clear</button>
              {notes.length > 1 && (
                <button onClick={() => deleteNote(i)} className="bg-destructive/10 text-destructive p-0.5 rounded transition opacity-50 hover:opacity-100" title="ডিলিট">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickNoteCard;
