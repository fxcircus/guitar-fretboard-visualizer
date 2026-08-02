import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import {
  CUSTOM_TUNING_ID,
  GROUP_LABELS,
  GROUP_ORDER,
  TUNINGS,
  type Tuning,
  type TuningGroup,
} from '../lib/tunings';

/**
 * The catalog is large enough that a plain <select> stops being usable, so this
 * is a searchable, grouped menu. Search matches the tuning name, its note
 * stack ("d a d g a d"), and its signature song, because those are the three
 * ways a player actually looks for a tuning.
 */

const Wrapper = styled.div`
  flex: 1;
  min-width: 220px;
  max-width: 420px;
  position: relative;
`;

const Trigger = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid ${({ $open, theme }) => ($open ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: ${({ theme }) => theme.colors.inputBackground};
  color: ${({ theme }) => theme.colors.text};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TriggerName = styled.span`
  font-weight: 700;
  flex-shrink: 0;
`;

const TriggerStack = styled.span`
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.08em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Chevron = styled.span<{ $open: boolean }>`
  margin-left: auto;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'none')};
`;

const Panel = styled.div`
  /* Portaled to document.body — outside any scoped wrapper, so it carries its
     own ground rules (a host page may not use border-box). */
  &,
  & * {
    box-sizing: border-box;
  }
  position: fixed;
  z-index: 9999;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  box-shadow: ${({ theme }) => theme.shadows.large};
  max-height: 62vh;
  display: flex;
  flex-direction: column;
`;

const SearchBox = styled.input`
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => `${theme.borderRadius.small} ${theme.borderRadius.small} 0 0`};
  background: ${({ theme }) => theme.colors.inputBackground};
  color: ${({ theme }) => theme.colors.text};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.sm};

  &:focus {
    outline: none;
    border-bottom-color: ${({ theme }) => theme.colors.primary};
  }
`;

const List = styled.div`
  overflow-y: auto;
`;

const GroupHeader = styled.div`
  padding: 7px 12px 3px;
  font-size: 10px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 1.2px;
  text-transform: uppercase;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  position: sticky;
  top: 0;
`;

const Option = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-bottom: 1px solid ${({ theme }) => `${theme.colors.border}44`};
  background: ${({ $selected, theme }) => ($selected ? `${theme.colors.primary}22` : 'transparent')};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  text-align: left;
  font-family: inherit;

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}11`};
  }
`;

const OptionName = styled.span`
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  min-width: 92px;
`;

const OptionStack = styled.span`
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.06em;
`;

const Count = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-left: auto;
  flex-shrink: 0;
`;

const Empty = styled.div`
  padding: 18px 12px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const searchKey = (t: Tuning) =>
  `${t.name} ${t.spellings.join(' ')} ${t.song ?? ''} ${t.description ?? ''}`
    .toLowerCase()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');

const HAYSTACK = new Map(TUNINGS.map((t) => [t.id, searchKey(t)]));

interface Props {
  tuningId: string;
  current: Tuning;
  onSelect: (id: string) => void;
  /**
   * Embed hook: the host needs to know whether the menu is open (and be able
   * to close it) so its Escape handling can peel layers instead of closing
   * everything at once.
   */
  menuRef?: React.MutableRefObject<{ open: boolean; close: () => void } | null>;
}

const TuningPicker: React.FC<Props> = ({ tuningId, current, onSelect, menuRef }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggle = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.max(rect.width, 320);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPos({ top: rect.bottom + 4, left: Math.max(8, left), width });
    }
    setQuery('');
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!menuRef) return;
    menuRef.current = { open, close: () => setOpen(false) };
    return () => {
      menuRef.current = null;
    };
  }, [open, menuRef]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/♯/g, '#').replace(/♭/g, 'b');
    const terms = q.split(/\s+/).filter(Boolean);
    const match = (t: Tuning) => {
      if (!terms.length) return true;
      const hay = HAYSTACK.get(t.id) ?? '';
      return terms.every((term) => hay.includes(term));
    };
    const out: Array<[TuningGroup, Tuning[]]> = [];
    for (const g of GROUP_ORDER) {
      const items = TUNINGS.filter((t) => t.group === g && match(t));
      if (items.length) out.push([g, items]);
    }
    return out;
  }, [query]);

  const total = grouped.reduce((n, [, items]) => n + items.length, 0);

  return (
    <Wrapper>
      <Trigger
        ref={triggerRef}
        $open={open}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Tuning"
      >
        <TriggerName>{current.name}</TriggerName>
        <TriggerStack>{current.spellings.join(' ')}</TriggerStack>
        <Chevron $open={open}>▼</Chevron>
      </Trigger>
      {open &&
        createPortal(
          <Panel
            ref={panelRef}
            role="listbox"
            aria-label="Tuning"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <SearchBox
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${TUNINGS.length} tunings — name, notes, or song…`}
              aria-label="Search tunings"
            />
            <List>
              {total === 0 && <Empty>Nothing matches “{query}”.</Empty>}
              {grouped.map(([group, items]) => (
                <React.Fragment key={group}>
                  <GroupHeader>
                    {GROUP_LABELS[group]}
                    <Count>{items.length}</Count>
                  </GroupHeader>
                  {items.map((t) => (
                    <Option
                      key={t.id}
                      role="option"
                      aria-selected={tuningId === t.id}
                      $selected={tuningId === t.id}
                      onClick={() => {
                        onSelect(t.id);
                        setOpen(false);
                      }}
                      title={[t.description, t.song].filter(Boolean).join(' · ')}
                    >
                      <OptionName>{t.name}</OptionName>
                      <OptionStack>{t.spellings.join(' ')}</OptionStack>
                      <Count>
                        {t.midi.length} str{t.reentrant ? ' · re-entrant' : ''}
                      </Count>
                    </Option>
                  ))}
                </React.Fragment>
              ))}
              <GroupHeader>Your own</GroupHeader>
              <Option
                role="option"
                aria-selected={tuningId === CUSTOM_TUNING_ID}
                $selected={tuningId === CUSTOM_TUNING_ID}
                onClick={() => {
                  onSelect(CUSTOM_TUNING_ID);
                  setOpen(false);
                }}
              >
                <OptionName>Custom…</OptionName>
                <OptionStack>tune each string yourself</OptionStack>
              </Option>
            </List>
          </Panel>,
          document.body
        )}
    </Wrapper>
  );
};

export default TuningPicker;
