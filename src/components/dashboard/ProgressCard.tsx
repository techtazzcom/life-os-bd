const ProgressCard = ({ progress }: { progress: number }) => (
  <div className="bg-card rounded-2xl p-5 border border-border border-l-4 border-l-life-green shadow-sm flex flex-col justify-center">
    <div className="flex justify-between mb-2 text-xs font-bold text-muted-foreground uppercase">
      <span>সামগ্রিক অগ্রগতি</span>
      <span>{progress}%</span>
    </div>
    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
      <div className="bg-life-green h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
    </div>
  </div>
);

export default ProgressCard;
