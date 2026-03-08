import { useState } from "react";
import type { Transaction } from "@/lib/dataStore";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

interface AccountPerson { trans: Transaction[]; }
interface Props {
  accounts: Record<string, AccountPerson>;
  onAccountsChange: (accounts: Record<string, AccountPerson>) => void;
}

const AccountCard = ({ accounts, onAccountsChange }: Props) => {
  const [personName, setPersonName] = useState("");
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [tAmt, setTAmt] = useState("");
  const [tNote, setTNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const addPerson = () => {
    if (!personName.trim()) return;
    onAccountsChange({ ...accounts, [personName]: { trans: [] } });
    setPersonName("");
  };

  const confirmDeletePerson = () => {
    if (!deleteTarget) return;
    const next = { ...accounts };
    delete next[deleteTarget];
    onAccountsChange(next);
    setDeleteTarget(null);
    if (activePerson === deleteTarget) setActivePerson(null);
  };

  const addTrans = (type: 'pawa' | 'dena') => {
    if (!tAmt || !activePerson) return;
    const next = { ...accounts };
    next[activePerson] = { trans: [...next[activePerson].trans, { type, amount: parseInt(tAmt), note: tNote || 'লেনদেন' }] };
    onAccountsChange(next);
    setTAmt(""); setTNote("");
  };

  const getBalance = (name: string) => {
    return accounts[name].trans.reduce((s, t) => s + (t.type === 'pawa' ? t.amount : -t.amount), 0);
  };

  return (
    <>
      <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-indigo shadow-sm">
        <h3 className="font-bold text-lg text-life-indigo mb-4">💰 পাওনা ও দেনা</h3>
        <div className="flex gap-2 mb-4">
          <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPerson()} placeholder="ব্যক্তির নাম..." className="flex-1 p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground" />
          <button onClick={addPerson} className="bg-life-indigo text-primary-foreground px-4 rounded-xl font-bold text-xs uppercase hover:opacity-90 transition active:scale-95">নতুন</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.keys(accounts).map(name => {
            const bal = getBalance(name);
            return (
              <div key={name} onClick={() => setActivePerson(name)} className={`relative group p-4 border-2 rounded-xl text-center cursor-pointer transition hover:shadow-md ${bal > 0 ? 'bg-life-emerald-light border-life-emerald/20 text-life-emerald' : bal < 0 ? 'bg-life-red-light border-destructive/20 text-destructive' : 'bg-secondary border-border text-foreground'}`}>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(name); }} className="absolute top-1.5 right-1.5 text-destructive/40 hover:text-destructive opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition text-sm">🗑️</button>
                <div className="font-bold text-sm truncate mb-1">{name}</div>
                <div className="font-black text-base">৳{Math.abs(bal)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {activePerson && accounts[activePerson] && (
        <div className="fixed inset-0 bg-foreground/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setActivePerson(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-foreground">{activePerson}</h3>
              <button onClick={() => setActivePerson(null)} className="text-muted-foreground hover:text-destructive text-2xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-life-emerald-light p-3 rounded-xl text-center"><p className="text-[10px] font-bold text-life-emerald uppercase">পাওনা</p><p className="text-lg font-black text-life-emerald">৳{accounts[activePerson].trans.filter(t => t.type === 'pawa').reduce((s, t) => s + t.amount, 0)}</p></div>
              <div className="bg-life-red-light p-3 rounded-xl text-center"><p className="text-[10px] font-bold text-destructive uppercase">দেনা</p><p className="text-lg font-black text-destructive">৳{accounts[activePerson].trans.filter(t => t.type === 'dena').reduce((s, t) => s + t.amount, 0)}</p></div>
            </div>
            <div className="space-y-2 mb-4">
              <input type="number" value={tAmt} onChange={e => setTAmt(e.target.value)} placeholder="টাকা" className="w-full p-3 border border-border rounded-xl font-bold outline-none text-foreground bg-secondary" />
              <input type="text" value={tNote} onChange={e => setTNote(e.target.value)} placeholder="বিবরণ" className="w-full p-3 border border-border rounded-xl font-bold outline-none text-foreground bg-secondary" />
              <div className="flex gap-2">
                <button onClick={() => addTrans('pawa')} className="flex-1 bg-life-emerald text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition">পাওনা (+)</button>
                <button onClick={() => addTrans('dena')} className="flex-1 bg-destructive text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition">দেনা (-)</button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {accounts[activePerson].trans.map((t, i) => (
                <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-xs font-bold ${t.type === 'pawa' ? 'bg-life-emerald-light text-life-emerald' : 'bg-life-red-light text-destructive'}`}>
                  <span>{t.note} (৳{t.amount})</span>
                  <button onClick={() => {
                    const next = { ...accounts };
                    next[activePerson] = { trans: next[activePerson].trans.filter((_, idx) => idx !== i) };
                    onAccountsChange(next);
                  }} className="opacity-30 hover:opacity-100 transition">🗑️</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDeletePerson}
        title={`"${deleteTarget}" ডিলেট করবেন?`}
        description="এই ব্যক্তির সমস্ত লেনদেন মুছে যাবে।"
      />
    </>
  );
};

export default AccountCard;
