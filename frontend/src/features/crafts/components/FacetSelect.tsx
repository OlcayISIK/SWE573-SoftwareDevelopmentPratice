interface FacetOption {
  value: string;
  label: string;
  count: number;
}

interface FacetSelectProps {
  id: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  options: FacetOption[];
  /** How to name the chosen value if the current results no longer include it. */
  chosenLabel?: string;
  onChange: (value: string | undefined) => void;
}

const fieldClass = "mt-1 block w-full rounded border border-stone-300 bg-white px-3 py-2";

/** A filter list that offers only the values found in the current results, with counts. */
export function FacetSelect({
  id,
  label,
  allLabel,
  value,
  options,
  chosenLabel,
  onChange,
}: FacetSelectProps) {
  // Keep the chosen value listed so the select still shows it.
  const shown =
    value && !options.some((option) => option.value === value)
      ? [...options, { value, label: chosenLabel ?? value, count: 0 }]
      : options;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={fieldClass}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">{allLabel}</option>
        {shown.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </div>
  );
}
