import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  className = "",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 group cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-xl">{icon}</span>}
          <h2 className="font-display text-2xl md:text-3xl text-charcoal !mt-0 !mb-0 !border-0 !pb-0">
            {title}
          </h2>
        </div>
        <svg
          className={`w-5 h-5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-[5000px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
