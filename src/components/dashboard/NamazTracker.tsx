const prayers = [
  { key: 'fajr', name: 'ফজর', icon: '🌅' },
  { key: 'dhuhr', name: 'যোহর', icon: '☀️' },
  { key: 'asr', name: 'আসর', icon: '🌤️' },
  { key: 'maghrib', name: 'মাগরিব', icon: '🌇' },
  { key: 'isha', name: 'এশা', icon: '🌙' },
];

interface Props {
  namaz: Record<string, boolean>;
  onNamazChange: (namaz: Record<string, boolean>) => void;
}

const NamazTracker = ({ namaz, onNamazChange }: Props) => {
  const toggle = (key: string) => {
    onNamazChange({ ...namaz, [key]: !namaz[key] });
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-emerald shadow-sm">
      <h3 className="font-bold text-life-emerald text-sm uppercase tracking-wider mb-4">🕌 নামাজ ট্র্যাকার</h3>
      <div className="space-y-3">
        {prayers.map(p => (
          <button key={p.key} onClick={() => toggle(p.key)} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border-2 ${namaz[p.key] ? 'bg-life-emerald border-life-emerald text-primary-foreground shadow-md' : 'bg-card border-border hover:border-life-emerald/50'}`}>
            <div className="flex items-center gap-3">
              <span className="text-xl">{p.icon}</span>
              <span className={`font-bold text-lg ${namaz[p.key] ? 'text-primary-foreground' : 'text-foreground'}`}>{p.name}</span>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${namaz[p.key] ? 'bg-card border-card' : 'border-border'}`}>
              {namaz[p.key] && <span className="text-life-emerald text-xs">✓</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default NamazTracker;
