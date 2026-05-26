// REQ-AGT-030, REQ-AGT-031: Agent mode switcher (Spec / Build)
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AgentMode } from './useAgentMessages';

interface ModeSwitcherProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
}

const OPTIONS: Array<{
  value: AgentMode;
  title: string;
  description: string;
}> = [
  {
    value: 'spec',
    title: 'Spec mode',
    description: 'RQML Agent will work on spec and design but not implement.',
  },
  {
    value: 'build',
    title: 'Build mode',
    description: 'RQML Agent works on all parts of the software process, including implementation.',
  },
];

const ModeIcon: React.FC<{ mode: AgentMode; size?: number; detailed?: boolean }> = ({
  mode,
  size = 14,
  detailed = false,
}) => {
  const common = {
    className: 'mode-switcher-icon',
    width: size,
    height: size,
    fill: 'none' as const,
    'aria-hidden': true,
  };

  if (mode === 'spec') {
    if (detailed) {
      // Detailed vertical scroll (📜 style): rolled bars at top and bottom,
      // parchment body in the middle with four ruled text lines.
      return (
        <svg {...common} viewBox="0 0 32 32">
          {/* Parchment side edges */}
          <path d="M7 6.5v19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 6.5v19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

          {/* Top roll */}
          <rect x="4" y="3" width="24" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.5 5.5h17" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />

          {/* Ruled text lines on the parchment */}
          <path d="M10 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
          <path d="M10 15h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
          <path d="M10 18h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
          <path d="M10 21h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />

          {/* Bottom roll */}
          <rect x="4" y="24" width="24" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.5 26.5h17" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
        </svg>
      );
    }
    // Compact scroll for the pill (16-px viewBox).
    return (
      <svg {...common} viewBox="0 0 16 16">
        <path
          d="M4 3h7.5a1.5 1.5 0 0 1 1.5 1.5v6.25c0 1.24-1.01 2.25-2.25 2.25H4.75"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="4" cy="4.5" rx="1.5" ry="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M4 6v6.25A1.75 1.75 0 0 0 5.75 14"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path d="M7 6.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M7 9h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }

  // Build mode
  if (detailed) {
    // Detailed code marks: four rows of mixed dots and dashes, evoking a
    // listing of instructions or punched-card code.
    return (
      <svg {...common} viewBox="0 0 32 32">
        {/* Row 1: dash · dash · dash */}
        <path d="M5 7h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 7h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18 7h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />

        {/* Row 2: dot · long dash · dot · dot */}
        <circle cx="6" cy="13" r="1.3" fill="currentColor" />
        <path d="M10 13h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="21" cy="13" r="1.3" fill="currentColor" />
        <circle cx="26" cy="13" r="1.3" fill="currentColor" />

        {/* Row 3: dash · dot · dash · dot */}
        <path d="M5 19h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="14" cy="19" r="1.3" fill="currentColor" />
        <path d="M17 19h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="26" cy="19" r="1.3" fill="currentColor" />

        {/* Row 4: dot · dash · dash */}
        <circle cx="6" cy="25" r="1.3" fill="currentColor" />
        <path d="M9 25h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 25h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  // Compact code marks for the pill.
  return (
    <svg {...common} viewBox="0 0 16 16">
      <path d="M3 5.5h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 5.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="3.5" cy="10.5" r="0.9" fill="currentColor" />
      <path d="M6 10.5h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="11.8" cy="10.5" r="0.9" fill="currentColor" />
    </svg>
  );
};

export const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ mode, onChange }) => {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position the portal-rendered popover above the button using fixed coords.
  // Portal escapes the `.input-textarea-wrapper`'s overflow:hidden clipping.
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setPopoverPos({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 4,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResizeOrScroll = () => setOpen(false);
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open]);

  const handleSelect = useCallback((next: AgentMode) => {
    if (next !== mode) onChange(next);
    setOpen(false);
  }, [mode, onChange]);

  const currentLabel = mode === 'spec' ? 'Spec mode' : 'Build mode';
  const tooltip = mode === 'spec'
    ? OPTIONS[0].description
    : OPTIONS[1].description;

  return (
    <div className="mode-switcher-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`mode-switcher mode-switcher-${mode}${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={`Agent mode: ${tooltip}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ModeIcon mode={mode} />
        <span className="mode-switcher-label">{currentLabel}</span>
        <svg
          className="mode-switcher-caret"
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M1 3l3 3 3-3z" />
        </svg>
      </button>
      {open && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="mode-switcher-popover"
          role="listbox"
          style={{ left: `${popoverPos.left}px`, bottom: `${popoverPos.bottom}px` }}
        >
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={mode === opt.value}
              className={`mode-switcher-option${mode === opt.value ? ' active' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="mode-switcher-option-icon">
                <ModeIcon mode={opt.value} size={30} detailed />
              </span>
              <span className="mode-switcher-option-body">
                <span className="mode-switcher-option-title">{opt.title}</span>
                <span className="mode-switcher-option-desc">{opt.description}</span>
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
