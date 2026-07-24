import React from 'react';

interface ToggleOption {
  label: string;
  value: string;
}

interface CustomToggleProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  profileColor?: string;
  className?: string;
}

export const CustomToggle: React.FC<CustomToggleProps> = ({
  options,
  value,
  onChange,
  className = "",
  profileColor = "#3db4f2"
}) => {
  return (
    <div className={`flex border border-gray/30 rounded-lg bg-white-100 p-[3px] ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`
            flex-1 py-1 text-sm font-medium rounded-md transition-all duration-200
            ${value === option.value ? 'text-white-100' : 'text-gray hover:text-gray'}
          `}
          style={{
            backgroundColor: value === option.value ? profileColor : 'transparent'
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
