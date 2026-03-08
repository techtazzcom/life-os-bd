import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Custom time input that works consistently on all devices.
 * Shows placeholder when empty, and formats as HH:MM.
 */
const TimeInput = ({ value, onChange, placeholder = "সময়", className }: TimeInputProps) => {
  const [display, setDisplay] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplay(value || "");
  }, [value]);

  const formatTime = (raw: string): string => {
    // Remove non-digits
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const isValidTime = (t: string): boolean => {
    const match = t.match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTime(e.target.value);
    setDisplay(formatted);
    if (isValidTime(formatted)) {
      onChange(formatted);
    } else if (formatted === "") {
      onChange("");
    }
  };

  const handleBlur = () => {
    if (display && !isValidTime(display)) {
      // Try to fix partial input
      const digits = display.replace(/\D/g, "");
      if (digits.length === 1) {
        const fixed = `0${digits}:00`;
        setDisplay(fixed);
        onChange(fixed);
      } else if (digits.length === 2) {
        const h = parseInt(digits);
        if (h <= 23) {
          const fixed = `${digits}:00`;
          setDisplay(fixed);
          onChange(fixed);
        } else {
          setDisplay(value || "");
        }
      } else if (digits.length === 3) {
        const fixed = `0${digits[0]}:${digits.slice(1)}`;
        if (isValidTime(fixed)) {
          setDisplay(fixed);
          onChange(fixed);
        } else {
          setDisplay(value || "");
        }
      } else {
        setDisplay(value || "");
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={5}
      className={cn(
        "text-center tabular-nums tracking-wider",
        !display && "text-muted-foreground",
        className
      )}
    />
  );
};

export default TimeInput;
