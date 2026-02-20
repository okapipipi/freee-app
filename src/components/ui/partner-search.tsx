"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { Search, X, Plus } from "lucide-react";

type Partner = { freeeId: number; name: string };

type Props = {
  value: { id: number | null; name: string };
  onChange: (v: { id: number | null; name: string }) => void;
  placeholder?: string;
  onCreateNew?: (name: string) => Promise<void>; // 新規作成ハンドラ（省略時は非表示）
};

export function PartnerSearch({
  value,
  onChange,
  placeholder = "取引先名で検索...",
  onCreateNew,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(value.name);
  const [results, setResults] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    onChange({ id: null, name: q });
    clearTimeout(timer.current);
    if (!q) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/partners/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.partners ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function select(p: Partner) {
    setQuery(p.name);
    onChange({ id: p.freeeId, name: p.name });
    setOpen(false);
    setResults([]);
  }

  function clear() {
    setQuery("");
    onChange({ id: null, name: "" });
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {value.id && (
        <p className="mt-1 text-xs text-green-600">
          ✓ freee取引先と連携済み（ID: {value.id}）
        </p>
      )}
      {query && !value.id && !loading && (
        <p className="mt-1 text-xs text-amber-600">
          ※ freeeに存在しない場合は承認時に新規作成されます
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => (
            <li
              key={p.freeeId}
              onMouseDown={() => select(p)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
            >
              {p.name}
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && query && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg text-sm overflow-hidden">
          <div className="px-3 py-2 text-gray-400">一致する取引先が見つかりません</div>
          {onCreateNew && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={async (e) => {
                e.preventDefault();
                setCreating(true);
                try {
                  await onCreateNew(query);
                  setOpen(false);
                } finally {
                  setCreating(false);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 border-t font-medium disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? "作成中..." : `「${query}」を新規取引先として作成`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
