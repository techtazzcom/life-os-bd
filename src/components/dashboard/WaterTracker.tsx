const WaterTracker = ({ water, onWaterChange }: { water: number; onWaterChange: (w: number) => void }) => (
  <div className="bg-card rounded-2xl p-5 border border-border border-l-4 border-l-primary shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-sm font-bold text-muted-foreground uppercase">পানি পান</h3>
      <span className="font-bold text-primary text-lg">{water}/৮</span>
    </div>
    <div className="flex gap-2">
      <button onClick={() => water < 12 && onWaterChange(water + 1)} className="bg-primary/10 text-primary w-10 h-10 rounded-xl hover:bg-primary/20 transition text-lg">💧</button>
      <button onClick={() => onWaterChange(0)} className="text-[10px] text-muted-foreground font-bold px-3 py-1 bg-secondary rounded-lg hover:bg-accent transition">রিসেট</button>
    </div>
  </div>
);

export default WaterTracker;
