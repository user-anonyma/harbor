import { Delete, Space } from "lucide-react";

// Netflix-style square alphabetical keyboard for TV/remote. 6-column grid of
// a-z + 0-9, with Space / Backspace / Clear on top. Each key is focusable so
// the spatial-nav engine moves between them naturally.
const KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

export function OnscreenKeyboard({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex gap-2.5">
        <Key onClick={() => onChange(value + " ")} label="Space" wide>
          <Space size={16} />
        </Key>
        <Key onClick={() => onChange(value.slice(0, -1))} label="Backspace" wide>
          <Delete size={16} />
        </Key>
        <Key onClick={() => onChange("")} label="Clear" wide>
          <span className="text-[12px] font-semibold">CLR</span>
        </Key>
      </div>
      <div className="grid grid-cols-6 gap-2.5">
        {KEYS.map((ch) => (
          <Key key={ch} onClick={() => onChange(value + ch)} label={ch}>
            {ch.toUpperCase()}
          </Key>
        ))}
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  label,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`harbor-card-focus flex h-14 items-center justify-center rounded-lg bg-elevated/70 text-[18px] font-semibold text-ink outline-none ring-1 ring-edge-soft/50 transition-all hover:bg-raised hover:text-ink focus-visible:scale-110 focus-visible:bg-accent focus-visible:text-white ${
        wide ? "w-[92px]" : "w-14"
      }`}
    >
      {children}
    </button>
  );
}
