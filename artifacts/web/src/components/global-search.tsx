"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./ui/input";

interface SearchResult {
  type: "product" | "customer" | "order" | "booking" | "invoice";
  id: string | number;
  label: string;
  preview?: string;
  category?: string;
}

interface GlobalSearchProps {
  onResultClick: (result: SearchResult) => void;
  lang?: "en" | "ne";
}

const ICONS: Record<SearchResult["type"], string> = {
  product: "📦",
  customer: "👤",
  order: "📋",
  booking: "🚗",
  invoice: "🧾",
};

export function GlobalSearch({ onResultClick, lang = "en" }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  const labels = {
    en: {
      placeholder: "Search products, customers, orders... (/ to open)",
      noResults: "No results found",
    },
    ne: {
      placeholder: "खोज गर्नुहोस्... (/ दबाएर खोल्नुहोस्)",
      noResults: "कुनै परिणाम भेटिएन",
    },
  };

  // Search API call with debounce
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setResults(data.results || []);
      setSelectedIndex(-1);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to open search
      if (e.key === "/" && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }

      // Arrow navigation
      if (isOpen && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
        } else if (e.key === "Enter" && selectedIndex >= 0) {
          e.preventDefault();
          handleSelectResult(results[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelectResult = (result: SearchResult) => {
    onResultClick(result);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={labels[lang].placeholder}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && (results.length > 0 || query.length >= 2) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg"
          >
            {results.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {results.map((result, index) => (
                  <motion.button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="mt-0.5 text-lg">
                      {ICONS[result.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900">
                        {result.label}
                      </div>
                      {result.preview && (
                        <div className="truncate text-sm text-gray-600">
                          {result.preview}
                        </div>
                      )}
                      {result.category && (
                        <div className="inline-block rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 mt-1">
                          {result.category}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {labels[lang].noResults}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
