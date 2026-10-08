import type { DevicePreferences } from '@/hooks/usePreviewMedia';
export default function BlurChoices({
  value = 'none',
  onChange,
  disabled = false,
}: {
  value?: DevicePreferences['blur'];
  onChange: (value: 'none' | 'low' | 'high') => void;
  disabled?: boolean;
}) {
  return (
    <section className="blur-options">
      <h3>Background blur</h3>
      <p>Keep the focus on you.</p>
      <div className="blur-choice-grid">
        {(
          [
            { value: 'none', label: 'No effect' },
            { value: 'low', label: 'Slight blur' },
            { value: 'high', label: 'Strong blur' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            className={`blur-choice ${value === option.value ? 'selected' : ''}`}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            <span
              className={`blur-choice-art blur-${option.value}`}
              aria-hidden="true"
            >
              <span>●</span>
            </span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
