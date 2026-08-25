import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { List } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
}

export default function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  required = false,
  onBlur,
  onKeyDown,
  id
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(o => 
    !value || o.toLowerCase().includes(value.toLowerCase())
  );

  // Find exact start match for ghost text
  const exactMatch = value && isOpen ? options.find(o => o.toLowerCase().startsWith(value.toLowerCase())) : null;
  const ghostText = exactMatch ? value + exactMatch.substring(value.length) : '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        onChange(filteredOptions[highlightedIndex]);
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (onKeyDown) onKeyDown(e);
        return;
      }
      
      // If we have ghost text and nothing is highlighted, accept ghost text
      // ONLY if it's different from the current value!
      if (isOpen && exactMatch && exactMatch.toLowerCase() !== value.toLowerCase()) {
        e.preventDefault();
        onChange(exactMatch);
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (onKeyDown) onKeyDown(e);
        return;
      }

      if (isOpen) {
        setIsOpen(false);
      }
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      } else if (onKeyDown) {
        onKeyDown(e);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (onKeyDown && e.key !== 'Enter') {
      // Pass other keys up unhindered
      onKeyDown(e);
    } else if (onKeyDown && e.key === 'Enter') {
      onKeyDown(e);
    }
  };

  return (
    <div className="flex w-full" ref={containerRef}>
      <div className="relative flex-1">
        {ghostText && exactMatch && exactMatch.toLowerCase() !== value.toLowerCase() && (
          <div className={`absolute inset-0 px-4 py-2 pointer-events-none text-gray-400 overflow-hidden whitespace-nowrap bg-transparent ${className}`}>
            <span className="opacity-0">{value}</span>
            <span>{exactMatch.substring(value.length)}</span>
          </div>
        )}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          required={required}
          className={`relative w-full px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-transparent ${className}`}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option}
                  className={`px-4 py-2 cursor-pointer text-sm ${
                    index === highlightedIndex ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option}
                </div>
              ))
            ) : null}
            {value && !options.some(o => o.toLowerCase() === value.toLowerCase()) && (
              <div className="px-4 py-2 text-sm text-blue-600 italic border-t border-gray-50">
                + Add "{value}"
              </div>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setHighlightedIndex(-1);
        }}
        className="bg-gray-100 border border-l-0 border-gray-300 px-3 rounded-r-lg hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
        title="View all options"
      >
        <List className="h-4 w-4 text-gray-600" />
      </button>
    </div>
  );
}
