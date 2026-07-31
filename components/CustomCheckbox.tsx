import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  profileColor?: string;
  className?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ 
  checked, 
  onChange, 
  label, 
  className = "",
  profileColor = "#3db4f2"
}) => {
  const [isChecked, setIsChecked] = useState(checked);

  useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  const handleChange = () => {
    const newChecked = !isChecked;
    setIsChecked(newChecked);
    onChange(newChecked);
  };

  return (
    <label
      className={`flex items-center cursor-pointer ${className}`}
      style={{ '--profile-color': profileColor } as React.CSSProperties}
    >
      {/* Hidden native checkbox for accessibility */}
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        className="peer opacity-0 absolute cursor-pointer w-0 h-0"
      />

      {/* Custom checkbox visual. The input is what takes focus, but it is 0x0
          and transparent — so the ring has to be drawn on this instead. */}
      <span
        className="h-4 w-4 relative transition-all duration-100 rounded border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:[outline-color:var(--profile-color)]"
        style={{
          backgroundColor: isChecked ? profileColor : '#ffffff',
          borderColor: isChecked ? profileColor : '#ddd'
        }}
      >
        {/* Checkmark */}
        {isChecked && (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </span>
      
      {/* Label text */}
      <span className='pl-2'>{label}</span>
    </label>
  );
}