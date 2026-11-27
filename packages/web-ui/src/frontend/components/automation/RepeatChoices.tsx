import { useState } from "react";
import "./RepeatChoices.css";

export const RepeatChoices = ({
  name,
  label,
  values,
  labels,
  initial,
}: {
  name: string;
  label: string;
  values: string[];
  labels: string[];
  initial: string;
}) => {
  const [selected, setSelected] = useState(() => initial.split(","));
  return (
    <details className="repeat-choices">
      <summary>
        <span>{label}</span>
        <span>
          {values
            .flatMap((value, index) => (selected.includes(value) ? [labels[index]] : []))
            .join(", ")}
        </span>
      </summary>
      <fieldset>
        <legend>{label}</legend>
        {values.map((value, index) => {
          const checked = selected.includes(value);
          return (
            <label key={value}>
              <input
                type="checkbox"
                checked={checked}
                aria-disabled={checked && selected.length === 1}
                onChange={() => {
                  if (!checked || selected.length > 1)
                    setSelected(
                      checked ? selected.filter((item) => item !== value) : [...selected, value],
                    );
                }}
              />
              {labels[index]}
            </label>
          );
        })}
      </fieldset>
      {values
        .filter((value) => selected.includes(value))
        .map((value) => (
          <input key={value} type="hidden" name={name} value={value} />
        ))}
    </details>
  );
};
