// Inline choice card for askUser tool calls
// Features: vertical layout, keyboard navigation (Tab/Enter), recommended badge, "Other" input
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { UserChoiceInfo } from './useAgentMessages';

interface UserChoiceCardProps {
  choice: UserChoiceInfo;
  onSelect: (choiceId: string, selected: string) => void;
}

export const UserChoiceCard: React.FC<UserChoiceCardProps> = ({ choice, onSelect }) => {
  const resolved = !!choice.selected;

  // Reorder options: recommended first, then rest
  const orderedOptions = useMemo(() => {
    const rec = choice.recommended;
    if (rec !== undefined && rec >= 0 && rec < choice.options.length) {
      return [choice.options[rec], ...choice.options.filter((_, i) => i !== rec)];
    }
    return [...choice.options];
  }, [choice.options, choice.recommended]);

  // Total items = ordered options + "Other"
  const totalItems = orderedOptions.length + 1;

  // Highlight index: 0 = recommended (or first), last = "Other"
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [otherActive, setOtherActive] = useState(false);
  const [otherText, setOtherText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the container when it first mounts (so keyboard works immediately).
  // Delayed to ensure the DOM is settled and no competing focus handlers override it.
  useEffect(() => {
    if (!resolved) {
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({ block: 'nearest' });
        containerRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [resolved]);

  // Focus the "Other" input when it becomes active
  useEffect(() => {
    if (otherActive && otherInputRef.current) {
      otherInputRef.current.focus();
    }
  }, [otherActive]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (resolved) return;

    // When inside the "Other" input, only handle Enter and Escape
    if (otherActive && e.target === otherInputRef.current) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (otherText.trim()) {
          onSelect(choice.choiceId, otherText.trim());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOtherActive(false);
        containerRef.current?.focus();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      setHighlightIndex(prev => {
        const next = e.shiftKey
          ? (prev - 1 + totalItems) % totalItems
          : (prev + 1) % totalItems;
        // If cycling away from "Other", deactivate its input
        if (next !== totalItems - 1) {
          setOtherActive(false);
        }
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex === totalItems - 1) {
        // "Other" is highlighted — activate text input
        setOtherActive(true);
      } else {
        onSelect(choice.choiceId, orderedOptions[highlightIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, totalItems - 1));
      if (highlightIndex + 1 !== totalItems - 1) setOtherActive(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
      setOtherActive(false);
    }
  }, [resolved, otherActive, otherText, highlightIndex, totalItems, orderedOptions, choice.choiceId, onSelect]);

  const isRecommended = (option: string) =>
    choice.recommended !== undefined && option === choice.options[choice.recommended];

  return (
    <div
      className={`user-choice-card${resolved ? ' choice-resolved' : ''}`}
      ref={containerRef}
      tabIndex={resolved ? undefined : 0}
      onKeyDown={handleKeyDown}
    >
      <div className="user-choice-question">{choice.question}</div>
      <div className="user-choice-options">
        {orderedOptions.map((option, i) => (
          <button
            key={option}
            className={
              'user-choice-option'
              + (highlightIndex === i && !resolved ? ' highlighted' : '')
              + (choice.selected === option ? ' selected' : '')
              + (isRecommended(option) ? ' recommended' : '')
            }
            disabled={resolved}
            tabIndex={-1}
            onClick={() => onSelect(choice.choiceId, option)}
            onMouseEnter={() => { if (!resolved) setHighlightIndex(i); }}
          >
            <span className="user-choice-option-text">{option}</span>
            {isRecommended(option) && !resolved && (
              <span className="recommended-badge">Recommended</span>
            )}
          </button>
        ))}
        {/* "Other" option */}
        <div
          className={
            'user-choice-other'
            + (highlightIndex === totalItems - 1 && !resolved ? ' highlighted' : '')
            + (choice.selected && !orderedOptions.includes(choice.selected) ? ' selected' : '')
          }
          onMouseEnter={() => { if (!resolved) setHighlightIndex(totalItems - 1); }}
        >
          {!otherActive ? (
            <button
              className="user-choice-option user-choice-other-btn"
              disabled={resolved}
              tabIndex={-1}
              onClick={() => {
                setHighlightIndex(totalItems - 1);
                setOtherActive(true);
              }}
            >
              Other...
            </button>
          ) : (
            <input
              ref={otherInputRef}
              className="user-choice-other-input"
              placeholder="Type your response and press Enter..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              disabled={resolved}
            />
          )}
        </div>
      </div>
      {resolved && (
        <div className="user-choice-status">Selected: {choice.selected}</div>
      )}
    </div>
  );
};
