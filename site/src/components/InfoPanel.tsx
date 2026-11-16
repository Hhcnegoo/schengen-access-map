import type { CSSProperties, ReactNode } from 'react';

export type InfoRow = { label: string; value: string; missing: boolean; active?: boolean };

type Props = {
  /** Control shown at the top of the card (the country select). */
  control?: ReactNode;
  /** Small line above the title, e.g. the kind of place shown. */
  overline?: string | undefined;
  /** Name and year of what is shown; `null` when there is nothing to list. */
  title: string | null;
  subtitle?: string | undefined;
  rows: InfoRow[];
  /** Shown instead of figures, e.g. when the choice has no rows this year. */
  message?: string | undefined;
  /** How to use the globe. */
  hint: string;
  footer?: ReactNode;
  closeLabel: string;
  /** Clears the choice; omitted when nothing is chosen. */
  onClose?: (() => void) | undefined;
};

/** Figures of the country chosen on the globe. */
export function InfoPanel({
  control,
  overline,
  title,
  subtitle,
  rows,
  message,
  hint,
  footer,
  closeLabel,
  onClose,
}: Props) {
  return (
    <aside className="info-card" aria-live="polite">
      {control}
      {/* The key restarts the entrance animation when the content changes. */}
      <div className="info-body" key={`${title ?? ''}|${subtitle ?? ''}`}>
        {onClose ? (
          <button
            type="button"
            className="icon-button info-close"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        ) : null}
        {overline ? <p className="overline">{overline}</p> : null}
        {title ? <h3>{title}</h3> : null}
        {subtitle ? <p className="note">{subtitle}</p> : null}
        {message ? <p className="note">{message}</p> : null}
        {rows.length > 0 ? (
          <dl className="info-rows">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={row.active ? 'is-active' : undefined}
                style={{ '--i': index } as CSSProperties}
              >
                <dt>{row.label}</dt>
                <dd className={row.missing ? 'is-no-data' : undefined}>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {footer}
      </div>
      <p className="hint">{hint}</p>
    </aside>
  );
}
