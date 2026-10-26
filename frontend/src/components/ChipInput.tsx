import { useState, type KeyboardEvent } from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
  className?: string;
};

function splitTerms(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ChipInput({ value, onChange, placeholder, id, className }: Props) {
  const [text, setText] = useState("");

  function commit(raw: string) {
    const terms = splitTerms(raw);
    if (!terms.length) return;
    const next = [...value];
    for (const term of terms) if (!next.some((item) => item.toLowerCase() === term.toLowerCase())) next.push(term);
    onChange(next);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(text);
    } else if (event.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-input-bg px-2 py-1.5 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        className,
      )}
    >
      {value.map((term) => (
        <span key={term} className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-2 text-xs font-medium text-secondary-foreground">
          {term}
          <button
            type="button"
            aria-label={`Remove ${term}`}
            className="grid size-4 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
            onClick={() => onChange(value.filter((item) => item !== term))}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(text)}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          if (/[\n,]/.test(pasted)) {
            event.preventDefault();
            commit(pasted);
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
