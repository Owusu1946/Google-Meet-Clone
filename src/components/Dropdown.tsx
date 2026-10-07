import { useId, type ReactNode } from 'react';
export default function Dropdown({
  label,
  icon,
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  dark = false,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  options: { label: string; value: string; onClick?: () => void }[];
  disabled?: boolean;
  className?: string;
  dark?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 border rounded-lg px-3 py-2 max-w-full ${dark ? 'border-border-gray text-white' : 'border-hairline-gray'} ${className}`}
    >
      {icon}
      <span className="sr-only">{label}</span>
      <select
        id={id}
        aria-label={label}
        className={`min-w-0 w-full text-sm ${dark ? 'bg-meet-black text-white' : 'bg-white'}`}
        value={value || ''}
        disabled={disabled || !options?.length}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">System default</option>
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label || 'Unnamed device'}
          </option>
        ))}
      </select>
    </label>
  );
}
