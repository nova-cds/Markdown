import React, { useState, useRef, useEffect } from 'react';
import { EMOJI_GROUPS } from '../../constants/emojiData';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeGroup, setActiveGroup] = useState<string>('表情');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={modalRef}
      className="emoji-picker-modal"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'var(--editor-bg, #fff)',
        border: '1px solid var(--editor-border, #e0e0e0)',
        borderRadius: '12px',
        padding: '16px',
        zIndex: 10000,
        minWidth: '400px',
        maxWidth: '500px',
        maxHeight: '80vh',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}
    >
      {/* 标题 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--editor-border, #e0e0e0)',
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--editor-text, #333)' }}>
          选择表情
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--editor-text-secondary, #666)',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      {/* 分组标签 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginBottom: '12px',
        }}
      >
        {Object.keys(EMOJI_GROUPS).map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              backgroundColor:
                activeGroup === group
                  ? 'var(--accent-500, #3b82f6)'
                  : 'var(--editor-code-bg, #f5f5f5)',
              color: activeGroup === group ? '#fff' : 'var(--editor-text, #333)',
              transition: 'all 0.15s ease',
            }}
          >
            {group}
          </button>
        ))}
      </div>

      {/* 表情网格 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          gap: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
          padding: '4px',
        }}
      >
        {EMOJI_GROUPS[activeGroup].map((emoji: string, index: number) => (
          <button
            key={`${emoji}-${index}`}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--editor-code-bg, #f5f5f5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
