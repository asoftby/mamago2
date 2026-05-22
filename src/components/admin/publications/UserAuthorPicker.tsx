"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthorUser {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
}

export interface UserAuthorPickerProps {
  /** Currently selected author id (null = no author). */
  value: string | null;
  /** Called when the user selects or clears an author. */
  onChange: (authorId: string | null) => void;
  /** Inline validation error message. */
  error?: string | null;
  disabled?: boolean;
}

// ─── Role label map ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  EDITOR: "Редактор",
  USER: "Пользователь",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = "sm" }: { user: AuthorUser; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  const initials = (user.displayName ?? user.email)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.displayName ?? user.email}
        className={cn("rounded-full object-cover shrink-0", dim)}
      />
    );
  }
  return (
    <span
      className={cn(
        "rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0",
        dim,
      )}
    >
      {initials || <UserRound className="h-3.5 w-3.5" />}
    </span>
  );
}

// ─── Selected author card ─────────────────────────────────────────────────────

function SelectedAuthorCard({
  author,
  onReplace,
  onClear,
  disabled,
}: {
  author: AuthorUser;
  onReplace: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <Avatar user={author} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {author.displayName ?? author.email}
        </p>
        {author.displayName && (
          <p className="truncate text-xs text-muted-foreground">{author.email}</p>
        )}
        <p className="text-xs text-muted-foreground">{roleLabel(author.role)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onReplace}
          disabled={disabled}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Сменить
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Убрать автора"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Search dropdown ──────────────────────────────────────────────────────────

function SearchDropdown({
  onSelect,
  onClose,
}: {
  onSelect: (user: AuthorUser) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuthorUser[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}&limit=20`)
        .then((r) => r.json())
        .then((data: AuthorUser[]) => {
          setResults(Array.isArray(data) ? data : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rounded-lg border border-border bg-background shadow-md">
      {/* Search input */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или e-mail…"
          className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
      </div>

      {/* Results list */}
      <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
        {results.length === 0 && !loading && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            {query ? "Не найдено" : "Начните вводить имя или e-mail"}
          </li>
        )}
        {results.map((u) => (
          <li key={u.id} role="option" aria-selected={false}>
            <button
              type="button"
              onClick={() => onSelect(u)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent"
            >
              <Avatar user={u} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {u.displayName ?? u.email}
                </span>
                {u.displayName && (
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                )}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {roleLabel(u.role)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Close footer */}
      <div className="border-t px-3 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
          Отмена
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserAuthorPicker({ value, onChange, error, disabled }: UserAuthorPickerProps) {
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorUser | null>(null);
  const [picking, setPicking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the saved author when the component mounts or value changes from outside.
  useEffect(() => {
    if (!value) {
      setSelectedAuthor(null);
      return;
    }
    // If we already have the user loaded and it matches, skip the fetch.
    if (selectedAuthor?.id === value) return;

    fetch(`/api/admin/users/search?id=${encodeURIComponent(value)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AuthorUser | null) => {
        if (data?.id) {
          setSelectedAuthor(data);
        } else {
          // Fallback placeholder if lookup fails.
          setSelectedAuthor({ id: value, displayName: null, email: value, avatarUrl: null, role: "" });
        }
      })
      .catch(() => {
        setSelectedAuthor({ id: value, displayName: null, email: value, avatarUrl: null, role: "" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!picking) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPicking(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [picking]);

  function handleSelect(user: AuthorUser) {
    setSelectedAuthor(user);
    onChange(user.id);
    setPicking(false);
  }

  function handleClear() {
    setSelectedAuthor(null);
    onChange(null);
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      {selectedAuthor && !picking ? (
        <SelectedAuthorCard
          author={selectedAuthor}
          onReplace={() => setPicking(true)}
          onClear={handleClear}
          disabled={disabled}
        />
      ) : picking ? (
        <SearchDropdown
          onSelect={handleSelect}
          onClose={() => setPicking(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicking(true)}
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground",
            error && "border-red-400",
          )}
        >
          <UserRound className="h-4 w-4 shrink-0" aria-hidden />
          Выбрать автора публикации
        </Button>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
