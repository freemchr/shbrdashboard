// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { PrimeUser } from '@/lib/prime-users';

// Module-boundary mock — drives the picker through directory states (PATTERNS Pattern 2 contract).
vi.mock('@/lib/prime-directory-context', () => ({
  usePrimeDirectory: vi.fn(),
}));

import { PrimeUserPicker } from './PrimeUserPicker';
import { usePrimeDirectory } from '@/lib/prime-directory-context';
const mockedUseDirectory = vi.mocked(usePrimeDirectory);

function makeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1', email: 'jane.doe@shbr.com', fullName: 'Jane Doe',
    firstName: 'Jane', lastName: 'Doe',
    division: null, region: null, roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}

function makeDirectory(overrides: Partial<ReturnType<typeof usePrimeDirectory>> = {}) {
  return {
    status: 'ready' as const,
    users: [] as PrimeUser[],
    byEmail: new Map<string, PrimeUser>(),
    lastSuccessAt: new Date().toISOString(),
    lastError: null as string | null,
    refresh: vi.fn(),
    refreshing: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PrimeUserPicker (D-22 — tri-state loading masks historical detection)', () => {
  it('does NOT render any chip with italic class while status="loading"', () => {
    mockedUseDirectory.mockReturnValue(makeDirectory({ status: 'loading', users: [], byEmail: new Map() }) as never);
    const { container } = render(<PrimeUserPicker selected={['unknown@x.com']} onChange={vi.fn()} placeholder="Search…" allowHistorical />);
    // Pitfall 1: while loading, even unknown emails MUST render as plain (no italic, no historical styling)
    const italicChips = container.querySelectorAll('.italic');
    expect(italicChips.length).toBe(0);
  });
});

describe('PrimeUserPicker (D-18 — substring filter across fullName, email, division)', () => {
  it('matches by fullName substring (case-insensitive)', () => {
    const users = [
      makeUser({ id: 'u1', email: 'jane@x.com', fullName: 'Jane Doe' }),
      makeUser({ id: 'u2', email: 'bob@x.com', fullName: 'Bob Smith' }),
    ];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'jane' } });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });

  it('matches by email substring', () => {
    const users = [
      makeUser({ id: 'u1', email: 'admin-one@x.com', fullName: 'Alice One' }),
      makeUser({ id: 'u2', email: 'jane@y.com', fullName: 'Jane Doe' }),
    ];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'admin-one' } });
    expect(screen.getByText('Alice One')).toBeInTheDocument();
  });

  it('matches by division substring', () => {
    const users = [
      makeUser({ id: 'u1', email: 'a@x.com', fullName: 'Alice', division: 'Estimators' }),
      makeUser({ id: 'u2', email: 'b@x.com', fullName: 'Bob',   division: 'Operations' }),
    ];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'estim' } });
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });
});

describe('PrimeUserPicker (D-19 — keyboard nav)', () => {
  it('ArrowDown advances aria-activedescendant', () => {
    const users = [makeUser({ id: 'u1', email: 'a@x.com', fullName: 'Alice' }), makeUser({ id: 'u2', email: 'b@x.com', fullName: 'Bob' })];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
  });

  it('Enter on highlighted row fires onChange with that email', () => {
    const onChange = vi.fn();
    const users = [makeUser({ id: 'u1', email: 'alice@x.com', fullName: 'Alice' })];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={onChange} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['alice@x.com']);
  });

  it('Backspace on empty input removes the last chip', () => {
    const onChange = vi.fn();
    const users = [makeUser({ id: 'u1', email: 'alice@x.com', fullName: 'Alice' })];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={['alice@x.com']} onChange={onChange} placeholder="Search…" />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('PrimeUserPicker (D-04/D-05 — chip add/remove + alphabetical)', () => {
  it('chips render in alphabetical order by fullName for live entries', () => {
    const users = [
      makeUser({ id: 'u1', email: 'b@x.com', fullName: 'Zoe Last' }),
      makeUser({ id: 'u2', email: 'a@x.com', fullName: 'Alice First' }),
    ];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={['b@x.com', 'a@x.com']} onChange={vi.fn()} placeholder="Search…" />);
    const chips = screen.getAllByRole('button', { name: /Remove/ });
    expect(chips[0].getAttribute('aria-label')).toBe('Remove Alice First');
    expect(chips[1].getAttribute('aria-label')).toBe('Remove Zoe Last');
  });

  it('clicking × calls onChange with the email removed', () => {
    const onChange = vi.fn();
    const users = [makeUser({ id: 'u1', email: 'alice@x.com', fullName: 'Alice' })];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={['alice@x.com']} onChange={onChange} placeholder="Search…" />);
    const removeBtn = screen.getByRole('button', { name: 'Remove Alice' });
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('PrimeUserPicker (D-07/D-08 — historical detection)', () => {
  it('renders chip with italic + text-gray-500 when email is NOT in byEmail (status=ready)', () => {
    mockedUseDirectory.mockReturnValue(makeDirectory({ users: [], byEmail: new Map() }) as never);
    const { container } = render(<PrimeUserPicker selected={['departed@x.com']} onChange={vi.fn()} placeholder="Search…" allowHistorical />);
    const italicChip = container.querySelector('.italic');
    expect(italicChip).not.toBeNull();
    expect(italicChip?.className).toContain('text-gray-500');
  });

  it('historical chip has the locked tooltip text', () => {
    mockedUseDirectory.mockReturnValue(makeDirectory({ users: [], byEmail: new Map() }) as never);
    const { container } = render(<PrimeUserPicker selected={['departed@x.com']} onChange={vi.fn()} placeholder="Search…" allowHistorical />);
    const chip = container.querySelector('[title]');
    expect(chip?.getAttribute('title')).toBe('Not in current directory snapshot — refresh to recheck');
  });
});

describe('PrimeUserPicker (D-20 — empty cache state)', () => {
  it('shows "Prime directory unavailable." + Refresh button when users.length === 0 AND status === "ready"', () => {
    mockedUseDirectory.mockReturnValue(makeDirectory({ users: [], byEmail: new Map() }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByText('Prime directory unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Try refreshing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh Prime directory/ })).toBeInTheDocument();
  });
});

describe('PrimeUserPicker (Pitfall 2 — option click swallow fix)', () => {
  it('listbox option has onMouseDown that calls preventDefault', () => {
    const users = [makeUser({ id: 'u1', email: 'a@x.com', fullName: 'Alice' })];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    const option = screen.getAllByRole('option')[0];
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('PrimeUserPicker (UI-SPEC §A11y — ARIA wiring per WAI-ARIA Combobox 1.2)', () => {
  it('search input has role="combobox" + aria-controls + aria-expanded + aria-autocomplete="list" + aria-label', () => {
    mockedUseDirectory.mockReturnValue(makeDirectory({ users: [], byEmail: new Map() }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-controls')).toBeTruthy();
    expect(input.getAttribute('aria-expanded')).toBeTruthy();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-label')).toBe('Search Prime users');
  });

  it('listbox has role="listbox" and rows have role="option" + aria-selected', () => {
    const users = [makeUser({ id: 'u1', email: 'a@x.com', fullName: 'Alice' })];
    mockedUseDirectory.mockReturnValue(makeDirectory({ users, byEmail: new Map(users.map(u => [u.email, u])) }) as never);
    render(<PrimeUserPicker selected={[]} onChange={vi.fn()} placeholder="Search…" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1);
    expect(options[0].getAttribute('aria-selected')).toBeDefined();
  });
});
