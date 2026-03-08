import { useState, useEffect } from "react";
import type { Medicine, MedicineDose } from "@/lib/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import TimeInput from "@/components/ui/time-input";

interface Props {
  medicines: Medicine[];
  doses: MedicineDose[];
  onMedicinesChange: (medicines: Medicine[]) => void;
  onDosesChange: (doses: MedicineDose[]) => void;
}

const MedicineCard = ({ medicines, doses, onMedicinesChange, onDosesChange }: Props) => {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const addTime = () => {
    if (time && !times.includes(time)) {
      setTimes([...times, time].sort());
      setTime("");
    }
  };

  const addMedicine = () => {
    if (!name.trim() || times.length === 0) return;
    const newMed: Medicine = { id: Date.now(), name, dose, times };
    onMedicinesChange([...medicines, newMed]);
    const newDoses = times.map(t => ({ medId: newMed.id, time: t, taken: false }));
    onDosesChange([...doses, ...newDoses]);
    setName(""); setDose(""); setTimes([]);
  };

  const toggleDose = (medId: number, doseTime: string) => {
    const existing = doses.find(d => d.medId === medId && d.time === doseTime);
    if (existing) {
      onDosesChange(doses.map(d => d.medId === medId && d.time === doseTime ? { ...d, taken: !d.taken } : d));
    } else {
      onDosesChange([...doses, { medId, time: doseTime, taken: true }]);
    }
  };

  const isDoseTaken = (medId: number, doseTime: string) => {
    return doses.find(d => d.medId === medId && d.time === doseTime)?.taken || false;
  };

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const getStatus = (medTime: string, taken: boolean) => {
    if (taken) return { label: "✅", color: "" };
    if (currentTime > medTime) return { label: "⚠️ মিস", color: "" };
    return { label: "⏳", color: "" };
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-pink shadow-sm">
      <h3 className="font-bold text-lg text-life-pink mb-4">💊 ওষুধ রিমাইন্ডার</h3>

      {/* Add Medicine Form */}
      <div className="space-y-2 mb-4 bg-life-pink-light p-3 rounded-xl border border-life-pink/20">
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="ওষুধের নাম..." className="w-full p-2.5 rounded-lg bg-card border border-border outline-none text-sm font-bold text-foreground min-w-0" />
          <TimeInput value={time} onChange={setTime} placeholder="HH:MM" className="w-full p-2.5 rounded-lg bg-card border border-border outline-none text-sm font-bold text-muted-foreground" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={dose} onChange={e => setDose(e.target.value)} placeholder="ডোজ" className="w-full p-2.5 rounded-lg bg-card border border-border outline-none text-sm font-bold text-foreground" />
          <button onClick={addTime} className="w-full bg-life-pink/20 text-life-pink p-2.5 rounded-lg text-sm font-bold hover:bg-life-pink/30 transition">+ সময়</button>
        </div>
        {times.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {times.map(t => (
              <span key={t} className="bg-card text-foreground text-[11px] font-bold px-2 py-1 rounded-lg border border-border flex items-center gap-1">
                🕐 {t}
                <button onClick={() => setTimes(times.filter(x => x !== t))} className="text-destructive/50 hover:text-destructive ml-0.5">✕</button>
              </span>
            ))}
          </div>
        )}
        <button onClick={addMedicine} className="w-full bg-life-pink text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition active:scale-[0.98]">ওষুধ যুক্ত করুন</button>
      </div>

      {/* Medicine List */}
      {medicines.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">কোনো ওষুধ যুক্ত করা হয়নি</p>
      ) : (
        <div className="space-y-3">
          {medicines.map(med => (
            <div key={med.id} className="bg-secondary rounded-xl border border-border p-3 group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground">{med.name}</h4>
                  {med.dose && <p className="text-[11px] text-muted-foreground font-semibold">ডোজ: {med.dose}</p>}
                </div>
                <button onClick={() => setDeleteId(med.id)} className="text-destructive/40 hover:text-destructive transition text-sm opacity-0 group-hover:opacity-100 max-sm:opacity-100">🗑️</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {med.times.map(t => {
                  const taken = isDoseTaken(med.id, t);
                  const status = getStatus(t, taken);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleDose(med.id, t)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition active:scale-95 ${taken ? 'border-life-emerald/30 bg-life-emerald-light text-life-emerald' : currentTime > t ? 'border-destructive/30 bg-life-red-light text-destructive animate-pulse' : 'border-border bg-card text-muted-foreground'}`}
                    >
                      <span>{t}</span>
                      <span>{status.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) {
            onMedicinesChange(medicines.filter(m => m.id !== deleteId));
            onDosesChange(doses.filter(d => d.medId !== deleteId));
            setDeleteId(null);
          }
        }}
        title="ওষুধটি ডিলেট করবেন?"
        description="এই ওষুধ এবং এর সকল রিমাইন্ডার মুছে ফেলা হবে।"
      />
    </div>
  );
};

export default MedicineCard;
