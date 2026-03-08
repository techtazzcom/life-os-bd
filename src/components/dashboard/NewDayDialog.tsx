import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  userName: string;
}

const greetings = [
  "নতুন দিন, নতুন সম্ভাবনা! 🌟",
  "আজকের দিনটি অসাধারণ করে তুলুন! ✨",
  "নতুন সূর্যোদয়, নতুন আশা! 🌅",
  "আল্লাহ আপনাকে সুন্দর একটি দিন দিন! 🤲",
  "আজ আরও ভালো করার সুযোগ! 💪",
];

const NewDayDialog = ({ open, onClose, userName }: Props) => {
  const [greeting] = useState(() => greetings[Math.floor(Math.random() * greetings.length)]);
  const today = new Date();
  const dateStr = format(today, "EEEE, d MMMM yyyy", { locale: bn });

  // Auto-close after 5 seconds
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 text-center p-0 overflow-hidden gap-0">
        {/* Decorative top */}
        <div className="bg-gradient-to-r from-primary/80 to-primary p-6 pb-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            {[...Array(12)].map((_, i) => (
              <span
                key={i}
                className="absolute text-2xl animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                ✨
              </span>
            ))}
          </div>
          <div className="relative z-10">
            <div className="text-5xl mb-3">🌙</div>
            <h2 className="text-xl font-black text-primary-foreground">
              শুভ রাত্রি পেরিয়ে নতুন দিন!
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-lg font-bold text-foreground">
            আসসালামু আলাইকুম, <span className="text-primary">{userName}</span>! 👋
          </p>
          <p className="text-base text-muted-foreground font-semibold">
            {greeting}
          </p>
          <div className="bg-secondary/50 rounded-xl px-4 py-3 border border-border">
            <p className="text-sm text-muted-foreground">📅 আজকের তারিখ</p>
            <p className="text-base font-black text-foreground mt-1">{dateStr}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            সব ট্র্যাকার নতুন করে শুরু হয়েছে 🔄
          </p>
          <button
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition"
          >
            চলুন শুরু করি! 🚀
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewDayDialog;
