import type { MeasureField } from '../data/types';
import { formatAxis } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import type { ColorScale } from '../viz/colorScale';

type Props = {
  field: MeasureField;
  scale: ColorScale;
  /** Show the swatch for areas that are outside the current view. */
  showNotListed: boolean;
};

/** Colour bar with labelled ends plus the "no data" swatch. */
export function MapLegend({ field, scale, showNotListed }: Props) {
  const { t, locale } = useI18n();
  const gradient = `linear-gradient(to right, ${scale.samples.join(', ')})`;
  return (
    <div className="legend">
      <div className="legend-scale">
        <div className="legend-bar" style={{ backgroundImage: gradient }} aria-hidden="true" />
        <div className="legend-ticks">
          {scale.ticks.map((tick) => (
            <span key={tick} style={{ left: `${scale.position(tick) * 100}%` }}>
              {formatAxis(field, tick, locale)}
            </span>
          ))}
        </div>
      </div>
      <ul className="legend-keys">
        <li>
          <span className="legend-swatch is-no-data" aria-hidden="true" />
          {t('value.noData')}
        </li>
        {showNotListed ? (
          <li>
            <span className="legend-swatch is-land" aria-hidden="true" />
            {t('map.legend.notListed')}
          </li>
        ) : null}
        {scale.kind === 'log' ? (
          <li className="legend-note">
            {t('map.legend.log')}; {t('map.legend.zero')}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
