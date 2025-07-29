import React, { useState, useRef, useEffect } from 'react';

interface LanguageOption {
  value: string;
  name: string;
}

interface CustomSelectProps {
  options: LanguageOption[];
  value: string;
  onChange: (value: string) => void;
  profileColor: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  className = "",
  profileColor = "#3db4f2"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      {/* Main select button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray/30 rounded-lg bg-white-100 text-gray focus:outline-none focus:border-blue text-left flex items-center justify-between"
      >
        <span>
          {selectedOption ? selectedOption.name : 'Select language'}
        </span>
        
        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-gray transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Options dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 border border-gray/30 rounded-lg bg-white-100 shadow-lg px-2 py-1">
          {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={`
              w-full px-2 py-1 my-1 text-left transition-colors duration-150 rounded-md hover:bg-white
              ${option.value === value 
                ? 'font-medium' 
                : 'text-gray'
              }
            `}
            style={{
              color: option.value === value ? profileColor : undefined
            }}
          >
            {option.name}
          </button>
          ))}
        </div>
      )}
    </div>
  );
};