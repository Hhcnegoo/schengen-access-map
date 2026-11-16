import type { ReactNode } from 'react';

export type InfoRow = { label: string; value: string; missing: boolean };

type Props = {
  /** Name and year of what was clicked; `null` before anything is chosen. */
  title: string | null;
  subtitle?: string | undefined;
  rows: InfoRow[];
  /** Shown instead of figures, e.g. when the choice has no rows this year. */
  message?: string | undefined;
  /** How to use the globe. */
  hint: string;
  footer?: ReactNode;
};

/** Figures of the country chosen on the globe. */
export function InfoPanel({ title, subtitle, rows, message, hint, footer }: Props) {
  return (
    <aside className="globe-info" aria-live="polite">
      {title ? (
        <>
          <h3>{title}</h3>
          {subtitle ? <p className="note">{subtitle}</p> : null}
          {message ? <p className="note">{message}</p> : null}
          {rows.length > 0 ? (
            <dl className="info-rows">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.missing ? 'is-no-data' : undefined}>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {footer}
        </>
      ) : null}
      <p className="note globe-hint">{hint}</p>
    </aside>
  );
}
