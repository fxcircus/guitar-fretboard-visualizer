import styled from 'styled-components';

/** Shared primitives. Deliberately unopinionated — restyle freely. */

export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.medium};
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

export const Label = styled.span`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

export const Hint = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.45;
`;

export const Toggle = styled.div`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.medium};
  padding: 2px;
`;

export const ToggleBtn = styled.button<{ $active: boolean }>`
  padding: 4px 10px;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.small};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  font-family: inherit;
  background: ${({ $active, theme }) => ($active ? `${theme.colors.primary}22` : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? `${theme.colors.primary}33` : theme.colors.border};
  }
`;

export const Chip = styled.button<{ $active?: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.4 : 1)};
  background: ${({ $active, theme }) => ($active ? `${theme.colors.primary}22` : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.text)};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 700;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ $disabled, theme }) =>
      $disabled ? theme.colors.border : theme.colors.primary};
  }
`;

export const Select = styled.select`
  padding: 5px 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: ${({ theme }) => theme.colors.inputBackground};
  color: ${({ theme }) => theme.colors.text};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  cursor: pointer;
`;

export const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 20px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 11px;
  font-family: inherit;
  line-height: 1;

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}22`};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export const Mono = styled.span`
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: 11px;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;
