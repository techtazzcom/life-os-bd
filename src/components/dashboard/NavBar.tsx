import { useState, useRef, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Props {
  userName: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onLogout: () => void;
  onSettings: () => void;
  onProfile: () => void;
  notificationSlot?: ReactNode;
}

const NavBar = ({ userName, selectedDate, onDateChange, onLogout, onSettings, onProfile, notificationSlot }: Props) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(selectedDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border p-3 md:p-4 shadow-sm">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-primary rounded-xl md:rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg text-base md:text-lg">⚡</div>
          <h1 className="text-lg md:text-2xl font-black tracking-tight text-foreground hidden sm:block">Life <span className="text-primary">OS</span></h1>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Date picker - collapsible on mobile */}
          <div className="hidden sm:flex items-center gap-1.5">
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="bg-card border border-border rounded-full px-3 py-1.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-36"
            />
            <button
              onClick={() => onDateChange(pendingDate)}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-bold hover:opacity-90 transition"
            >
              দেখুন
            </button>
            <button
              onClick={() => { const today = format(new Date(), 'yyyy-MM-dd'); setPendingDate(today); onDateChange(today); }}
              className="bg-secondary text-foreground px-3 py-1.5 rounded-full text-xs font-bold hover:bg-secondary/80 transition border border-border"
            >
              আজ
            </button>
          </div>

          {/* Mobile date toggle */}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition text-sm"
          >
            📅
          </button>

          {/* Profile */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 bg-card border border-border px-2 md:px-3 py-1.5 rounded-full text-sm font-bold text-foreground hover:border-primary transition">
              <span className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-black">{userName.charAt(0)}</span>
              <span className="hidden md:inline text-sm">{userName}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-2xl shadow-xl w-44 overflow-hidden animate-fade-in-up z-50">
                <button onClick={() => { onSettings(); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary transition flex items-center gap-2">⚙️ সেটিংস</button>
                <button onClick={() => { onProfile(); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary transition flex items-center gap-2">👤 প্রোফাইল</button>
                <button onClick={onLogout} className="w-full text-left px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition flex items-center gap-2">🚪 লগআউট</button>
              </div>
            )}
          </div>

          {/* Notification */}
          {notificationSlot}
        </div>
      </div>

      {/* Mobile date picker dropdown */}
      {showDatePicker && (
        <div className="sm:hidden mt-3 flex items-center gap-2 animate-fade-in-up">
          <input
            type="date"
            value={pendingDate}
            onChange={(e) => setPendingDate(e.target.value)}
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => { onDateChange(pendingDate); setShowDatePicker(false); }}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition"
          >
            দেখুন
          </button>
          <button
            onClick={() => { const today = format(new Date(), 'yyyy-MM-dd'); setPendingDate(today); onDateChange(today); setShowDatePicker(false); }}
            className="bg-secondary text-foreground px-3 py-2 rounded-xl text-xs font-bold hover:bg-secondary/80 transition border border-border"
          >
            আজ
          </button>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
