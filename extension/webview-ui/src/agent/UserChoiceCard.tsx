// Inline choice card for /implement askUser tool calls
import React from 'react';
import type { UserChoiceInfo } from './useAgentMessages';

interface UserChoiceCardProps {
  choice: UserChoiceInfo;
  onSelect: (choiceId: string, selected: string) => void;
}

export const UserChoiceCard: React.FC<UserChoiceCardProps> = ({ choice, onSelect }) => {
  const resolved = !!choice.selected;

  return (
    <div className={`user-choice-card${resolved ? ' choice-resolved' : ''}`}>
      <div className="user-choice-question">{choice.question}</div>
      <div className="user-choice-options">
        {choice.options.map((option) => (
          <button
            key={option}
            className={`user-choice-option${choice.selected === option ? ' selected' : ''}`}
            disabled={resolved}
            onClick={() => onSelect(choice.choiceId, option)}
          >
            {option}
          </button>
        ))}
      </div>
      {resolved && (
        <div className="user-choice-status">Selected: {choice.selected}</div>
      )}
    </div>
  );
};
