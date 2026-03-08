import { useState } from "react";
import type { Expense } from "@/lib/dataStore";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

interface Props {
  expenses: Expense[];
  onExpensesChange: (expenses: Expense[]) => void;
}

const ExpenseCard = ({ expenses, onExpensesChange }: Props) => {
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const total = expenses.reduce((s, e) => s + e.amt, 0);

  const addExpense = () => {
    if (!amt || !note) return;
    onExpensesChange([{ id: Date.now(), note, amt: parseInt(amt) }, ...expenses]);
    setAmt(""); setNote("");
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-teal shadow-sm">
      <h3 className="font-bold text-life-teal uppercase text-sm mb-4">💸 আজকের ব্যয়</h3>
      <div className="space-y-2 mb-4">
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="টাকা" className="w-full p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground" />
        <div className="flex gap-2">
          <input type="text" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExpense()} placeholder="খাত (কীসে খরচ?)" className="flex-1 p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground" />
          <button onClick={addExpense} className="bg-life-teal text-primary-foreground px-4 rounded-xl hover:opacity-90 transition active:scale-95">➕</button>
        </div>
      </div>
      <ul className="space-y-2 text-sm max-h-48 overflow-y-auto no-scrollbar">
        {expenses.map(e => (
          <li key={e.id} className="flex justify-between items-center bg-secondary p-3 rounded-xl border border-border">
            <span className="font-bold text-foreground">{e.note}</span>
            <div className="flex items-center gap-2">
              <span className="text-life-teal font-black">৳{e.amt}</span>
              <button onClick={() => setDeleteId(e.id)} className="text-destructive/40 hover:text-destructive transition text-xs">🗑️</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-lg">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">মোট</span>
        <span className="font-black text-life-teal">৳{total}</span>
      </div>
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId !== null) { onExpensesChange(expenses.filter(x => x.id !== deleteId)); setDeleteId(null); } }}
        title="খরচটি ডিলেট করবেন?"
      />
    </div>
  );
};

export default ExpenseCard;
