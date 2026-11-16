import type { Locale } from './format';

/**
 * Interface texts. Terms follow the column headers of the European
 * Commission's files. Texts describe what a figure is; they do not comment
 * on it. `{name}` marks a placeholder.
 */
const en = {
  'app.title': 'Schengen Access Map',
  'app.subtitle':
    'Uniform visa statistics for consulates of the Schengen States located in seven countries, 2019–\u20602025',
  'app.lead':
    'Figures come from the European Commission’s yearly “Visa statistics for consulates” files. They describe consulates by location, not applicants by nationality.',
  'app.skip': 'Skip to content',
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.ru': 'Русский',

  'app.overline': 'European Commission visa statistics · 2019–2025',
  'controls.label': 'Display settings',
  'controls.play': 'Play the years in turn',
  'controls.pause': 'Pause',
  'info.close': 'Clear the choice',
  'info.overline.states': 'Schengen State',
  'controls.year': 'Year',
  'controls.metric': 'Indicator',
  'controls.country': 'Country of consulate location',
  'controls.allCountries': 'All seven countries',

  'metric.uniform_applied': 'Uniform visas applied for',
  'metric.uniform_issued': 'Uniform visas issued',
  'metric.mev_issued': 'Multiple-entry visas (MEVs) issued',
  'metric.ltv_issued': 'LTVs issued',
  'metric.uniform_not_issued': 'Uniform visas not issued',
  'metric.mev_share': 'Share of MEVs',
  'metric.not_issued_rate': 'Not issued rate',
  'metric.short.uniform_applied': 'Applied for',
  'metric.short.uniform_issued': 'Issued',
  'metric.short.mev_issued': 'MEVs issued',
  'metric.short.ltv_issued': 'LTVs issued',
  'metric.short.uniform_not_issued': 'Not issued',
  'metric.short.mev_share': 'Share of MEVs',
  'metric.short.not_issued_rate': 'Not issued rate',
  'metric.note.mev_issued': 'part of uniform visas issued',
  'metric.note.ltv_issued': 'visas with limited territorial validity',
  'metric.note.mev_share': 'MEVs issued ÷ uniform visas issued',
  'metric.note.not_issued_rate': 'not issued ÷ (issued + LTVs + not issued)',

  'value.noData': 'no data',

  'map.title': '{metric}, {year}',
  'map.view.label': 'Map shows',
  'map.view.countries': 'Consulate countries',
  'map.view.states': 'Schengen States',
  'map.caption.countries': 'Consulates of all listed Schengen States, by country where they are located.',
  'map.caption.states':
    'Location of consulates: {selection}. Coloured by the Schengen State that operates them.',
  'map.hint':
    'Rest the pointer on a coloured country to zoom in on it, then click it to see its figures. On a touch screen, tap the country. Drag the globe to turn it.',
  'map.zoomIn': 'Zoom in',
  'map.zoomOut': 'Zoom out',
  'map.reset': 'Show the whole globe',
  'map.info.title': '{name}, {year}',
  'map.info.located': 'Location of consulates: {selection}',
  'map.info.notListed': 'The source lists no consulate of this State for this selection and year.',
  'map.info.details': 'More figures below',
  'map.loading': 'Loading the map…',
  'map.error': 'The map could not be loaded. The tables below hold the same figures.',
  'map.aria': 'Map: {metric}, {year}',
  'map.select': 'Show {name}',
  'map.legend.log': 'logarithmic scale',
  'map.legend.zero': 'zero and values below the scale use the first colour',
  'map.legend.notListed': 'not in this view',
  'map.boundaries':
    'Boundaries: Natural Earth via world-atlas, shown for orientation only. They do not express a position on the status of any territory.',

  'compare.title': 'By country and year',
  'compare.caption': '{metric}. Select a country name to open its details.',
  'compare.country': 'Country',

  'detail.title': '{selection}, {year}',
  'detail.coverage':
    'Consulate entries in the source: {entries}, of which with applications: {withApplications}. Schengen States listed: {states}, of which with applications: {statesWithApplications}.',
  'detail.blank.title': 'Empty cells in the source for this selection:',
  'detail.blank.item': '{metric} — {blank} of {entries} entries',
  'detail.rateSource':
    'Printed in the {year} source file, which divides by applications: {value}',

  'trend.title': '{selection}, 2019–2025',
  'trend.caption': 'One chart per indicator. Each chart has its own vertical scale starting at zero.',
  'trend.table': 'Show as table',
  'trend.charts': 'Show as charts',
  'trend.year': 'Year',

  'states.title.states': 'By Schengen State, {year}',
  'states.title.consulates': 'By consulate, {year}',
  'states.tab.label': 'Breakdown',
  'states.tab.states': 'Schengen States',
  'states.tab.consulates': 'Consulates',
  'states.column.state': 'Schengen State',
  'states.column.country': 'Country',
  'states.column.city': 'City',
  'states.column.entries': 'Consulate entries',
  'states.sort': 'Sort by {column}',
  'states.sorted.ascending': 'sorted ascending',
  'states.sorted.descending': 'sorted descending',
  'states.caption': '{selection}. Empty source cells are shown as “no data”.',

  'method.title': 'Method and notes',
  'method.source.title': 'Source',
  'method.source.text':
    'All figures come from the yearly “Visa statistics for consulates” workbooks published by the {publisher} on the page “Short-stay visas issued by Schengen countries”. The site uses the sheet “Data for consulates” of the files for 2019 to 2025, retrieved on {retrieved}.',
  'method.source.link': 'Source page',
  'method.scope.title': 'What is counted',
  'method.scope.rows':
    'Each source row is one consulate of one Schengen State in one city. The site keeps the rows of consulates located in Armenia, Azerbaijan, Belarus, Kazakhstan, Kyrgyzstan, Russia and Uzbekistan.',
  'method.scope.location':
    'Figures describe where applications were lodged. They are not broken down by the nationality of applicants.',
  'method.scope.criterion':
    'The countries were selected because their nationals required a visa for short stays in the Schengen area during the whole 2019–2025 period (Regulation (EU) 2018/1806, Annex I).',
  'method.terms.title': 'Terms',
  'method.terms.applied': 'Uniform visas applied for — applications for uniform short-stay visas lodged at the consulate.',
  'method.terms.issued':
    'Uniform visas issued — source column “Total uniform visas issued (including MEV)”. A uniform visa is valid for the territory of all Schengen States.',
  'method.terms.mev': 'Multiple-entry visas (MEVs) — uniform visas issued for multiple entries; part of uniform visas issued.',
  'method.terms.ltv':
    'LTVs — short-stay visas with limited territorial validity, valid only for the territory of the State or States for which they are issued.',
  'method.terms.notIssued': 'Uniform visas not issued — source column of the same name.',
  'method.terms.share': 'Share of MEVs = MEVs issued ÷ uniform visas issued.',
  'method.terms.rate':
    'Not issued rate = uniform visas not issued ÷ (uniform visas issued + LTVs issued + uniform visas not issued).',
  'method.derived.title': 'Sums and ratios',
  'method.derived.sums':
    'Sums by country, by Schengen State and for the seven countries combined add up the source rows. The two ratios are recomputed from those sums. For every year the country sums equal the totals printed in the source sheet “Totals - third country”.',
  'method.derived.rate2019':
    'The 2020–2025 files compute the not issued rate with the formula above. The 2019 file divides uniform visas not issued by uniform visas applied for. The site applies the formula above to every year, so a 2019 rate can differ from the one printed in the 2019 file; the printed value is shown next to the rate.',
  'method.coverage.title': 'Coverage by year',
  'method.coverage.states':
    'The source sheet lists the States fully applying the Schengen acquis in the reporting year. Croatia is listed from the 2023 file. Bulgaria and Romania are listed from the 2024 file; according to that file, their figures on this sheet cover the period after 31 March 2024.',
  'method.coverage.national':
    'National short-stay visas issued by Bulgaria, Croatia and Romania before those dates, and by Cyprus in every year, are published on a separate sheet and are not included.',
  'method.coverage.other':
    'Ireland is not covered by the source: it maintains its own visa policy. Liechtenstein does not issue its own Schengen visas and is not listed.',
  'method.coverage.listed': 'Schengen States on the source sheet, by first year in this dataset:',
  'method.missing.title': 'Missing values',
  'method.missing.text':
    'An empty cell in the source is shown as “no data”. It is not treated as zero. Sums skip empty cells, and the details of a selection list how many cells were empty. A ratio is shown as “no data” when a figure it needs is empty or when its denominator is zero.',
  'method.names.title': 'City names',
  'method.names.text':
    'City names follow the source. Where the files use two spellings for one city, the figures are shown under one name:',
  'method.checks.title': 'Checks',
  'method.checks.text':
    'The pipeline compares the rows with the totals printed in each file and stops if they disagree. One inconsistency inside the 2024 file (the “Total worldwide” row for LTVs issued) is recorded in the validation report.',
  'method.checks.link': 'Validation report (JSON)',
  'method.map.title': 'Map',
  'method.map.text':
    'Boundaries come from Natural Earth (world-atlas, 1:50m) and are shown for orientation only. They do not express a position on the legal status of any territory or border.',
  'method.download.title': 'Data',
  'method.download.text': 'The processed tables behind this site:',
  'method.download.files': 'Source files by year:',

  'download.consulate_year': 'Consulates by year (CSV)',
  'download.country_state_year': 'Countries by Schengen State and year (CSV)',
  'download.country_year': 'Countries by year (CSV)',
  'download.state_year': 'Schengen States by year, seven countries combined (CSV)',
  'download.total_year': 'Seven countries combined by year (CSV)',
  'download.reporting_states': 'Schengen States on the source sheet by year (CSV)',

  'footer.source': 'Source: European Commission, “Short-stay visas issued by Schengen countries”.',
} as const;

export type MessageKey = keyof typeof en;

const ru: Record<MessageKey, string> = {
  'app.title': 'Schengen Access Map',
  'app.subtitle':
    'Статистика единых виз по консульствам государств Шенгенской зоны в семи странах, 2019–\u20602025',
  'app.lead':
    'Данные взяты из ежегодных файлов Европейской комиссии «Visa statistics for consulates». Они описывают консульства по месту расположения, а не заявителей по гражданству.',
  'app.skip': 'Перейти к содержанию',
  'lang.label': 'Язык',
  'lang.en': 'English',
  'lang.ru': 'Русский',

  'app.overline': 'Визовая статистика Европейской комиссии · 2019–2025',
  'controls.label': 'Параметры отображения',
  'controls.play': 'Показать годы по очереди',
  'controls.pause': 'Пауза',
  'info.close': 'Сбросить выбор',
  'info.overline.states': 'Государство Шенгенской зоны',
  'controls.year': 'Год',
  'controls.metric': 'Показатель',
  'controls.country': 'Страна расположения консульств',
  'controls.allCountries': 'Все семь стран',

  'metric.uniform_applied': 'Запрошено единых виз',
  'metric.uniform_issued': 'Выдано единых виз',
  'metric.mev_issued': 'Выдано многократных виз (MEV)',
  'metric.ltv_issued': 'Выдано виз LTV',
  'metric.uniform_not_issued': 'Не выдано единых виз',
  'metric.mev_share': 'Доля многократных виз',
  'metric.not_issued_rate': 'Доля невыданных виз',
  'metric.short.uniform_applied': 'Запрошено',
  'metric.short.uniform_issued': 'Выдано',
  'metric.short.mev_issued': 'Многократных',
  'metric.short.ltv_issued': 'Визы LTV',
  'metric.short.uniform_not_issued': 'Не выдано',
  'metric.short.mev_share': 'Доля многократных',
  'metric.short.not_issued_rate': 'Доля невыданных',
  'metric.note.mev_issued': 'входят в число выданных единых виз',
  'metric.note.ltv_issued': 'визы с ограниченным территориальным действием',
  'metric.note.mev_share': 'многократные ÷ выданные единые визы',
  'metric.note.not_issued_rate': 'не выдано ÷ (выдано + LTV + не выдано)',

  'value.noData': 'нет данных',

  'map.title': '{metric}, {year}',
  'map.view.label': 'На карте',
  'map.view.countries': 'Страны консульств',
  'map.view.states': 'Шенгенские государства',
  'map.caption.countries':
    'Консульства всех перечисленных в источнике государств Шенгенской зоны — по стране, где они расположены.',
  'map.caption.states':
    'Расположение консульств: {selection}. Цвет — по государству Шенгенской зоны, которому принадлежат консульства.',
  'map.hint':
    'Задержите курсор на закрашенной стране, чтобы приблизить её, затем нажмите на неё, чтобы увидеть данные. На сенсорном экране коснитесь страны. Глобус можно поворачивать перетаскиванием.',
  'map.zoomIn': 'Приблизить',
  'map.zoomOut': 'Отдалить',
  'map.reset': 'Показать весь глобус',
  'map.info.title': '{name}, {year}',
  'map.info.located': 'Расположение консульств: {selection}',
  'map.info.notListed':
    'В источнике нет консульств этого государства для этой выборки и года.',
  'map.info.details': 'Больше данных ниже',
  'map.loading': 'Карта загружается…',
  'map.error': 'Не удалось загрузить карту. Те же данные приведены в таблицах ниже.',
  'map.aria': 'Карта: {metric}, {year}',
  'map.select': 'Показать: {name}',
  'map.legend.log': 'логарифмическая шкала',
  'map.legend.zero': 'ноль и значения ниже шкалы показаны первым цветом',
  'map.legend.notListed': 'нет в этом представлении',
  'map.boundaries':
    'Границы: Natural Earth (world-atlas), показаны только для ориентира и не выражают позиции о статусе каких-либо территорий.',

  'compare.title': 'По странам и годам',
  'compare.caption': '{metric}. Выберите название страны, чтобы открыть подробности.',
  'compare.country': 'Страна',

  'detail.title': '{selection}, {year}',
  'detail.coverage':
    'Строк консульств в источнике: {entries}, из них с заявлениями: {withApplications}. Государств Шенгенской зоны в источнике: {states}, из них с заявлениями: {statesWithApplications}.',
  'detail.blank.title': 'Пустые ячейки в источнике для этой выборки:',
  'detail.blank.item': '{metric} — {blank} из {entries} строк',
  'detail.rateSource':
    'В файле-источнике за {year} год, где делителем служит число заявлений: {value}',

  'trend.title': '{selection}, 2019–2025',
  'trend.caption':
    'Отдельный график для каждого показателя. У каждого графика своя вертикальная шкала, начинающаяся с нуля.',
  'trend.table': 'Показать таблицей',
  'trend.charts': 'Показать графиками',
  'trend.year': 'Год',

  'states.title.states': 'По государствам Шенгенской зоны, {year}',
  'states.title.consulates': 'По консульствам, {year}',
  'states.tab.label': 'Разбивка',
  'states.tab.states': 'Государства Шенгенской зоны',
  'states.tab.consulates': 'Консульства',
  'states.column.state': 'Государство Шенгенской зоны',
  'states.column.country': 'Страна',
  'states.column.city': 'Город',
  'states.column.entries': 'Строк консульств',
  'states.sort': 'Сортировать по столбцу «{column}»',
  'states.sorted.ascending': 'отсортировано по возрастанию',
  'states.sorted.descending': 'отсортировано по убыванию',
  'states.caption': '{selection}. Пустые ячейки источника показаны как «нет данных».',

  'method.title': 'Методика и примечания',
  'method.source.title': 'Источник',
  'method.source.text':
    'Все данные взяты из ежегодных файлов «Visa statistics for consulates», которые {publisher} публикует на странице «Short-stay visas issued by Schengen countries». Используется лист «Data for consulates» файлов за 2019–2025 годы, загруженных {retrieved}.',
  'method.source.link': 'Страница источника',
  'method.scope.title': 'Что учитывается',
  'method.scope.rows':
    'Каждая строка источника — одно консульство одного государства Шенгенской зоны в одном городе. На сайте используются строки консульств, расположенных в Армении, Азербайджане, Беларуси, Казахстане, Кыргызстане, России и Узбекистане.',
  'method.scope.location':
    'Данные показывают, где были поданы заявления. Разбивки по гражданству заявителей в источнике нет.',
  'method.scope.criterion':
    'Страны отобраны по признаку: их гражданам в течение всего периода 2019–2025 годов требовалась виза для краткосрочного пребывания в Шенгенской зоне (Регламент (ЕС) 2018/1806, приложение I).',
  'method.terms.title': 'Термины',
  'method.terms.applied':
    'Запрошено единых виз (uniform visas applied for) — заявления на единые краткосрочные визы, поданные в консульство.',
  'method.terms.issued':
    'Выдано единых виз (uniform visas issued) — столбец источника «Total uniform visas issued (including MEV)». Единая виза действительна на территории всех государств Шенгенской зоны.',
  'method.terms.mev':
    'Многократные визы (multiple-entry visas, MEV) — единые визы, выданные для многократного въезда; входят в число выданных единых виз.',
  'method.terms.ltv':
    'LTV — краткосрочные визы с ограниченным территориальным действием: действительны только на территории государства или государств, для которых выданы.',
  'method.terms.notIssued':
    'Не выдано единых виз (uniform visas not issued) — одноимённый столбец источника.',
  'method.terms.share':
    'Доля многократных виз (share of MEVs) = выдано многократных ÷ выдано единых виз.',
  'method.terms.rate':
    'Доля невыданных виз (not issued rate) = не выдано единых виз ÷ (выдано единых виз + выдано LTV + не выдано единых виз).',
  'method.derived.title': 'Суммы и доли',
  'method.derived.sums':
    'Суммы по стране, по государству Шенгенской зоны и по семи странам вместе складываются из строк источника. Обе доли пересчитываются из этих сумм. За каждый год суммы по странам совпадают с итогами, напечатанными на листе источника «Totals - third country».',
  'method.derived.rate2019':
    'В файлах за 2020–2025 годы доля невыданных виз считается по приведённой выше формуле. В файле за 2019 год число невыданных единых виз делится на число запрошенных. На сайте формула выше применяется ко всем годам, поэтому значение за 2019 год может отличаться от напечатанного в файле за 2019 год; напечатанное значение показано рядом.',
  'method.coverage.title': 'Охват по годам',
  'method.coverage.states':
    'На листе источника перечислены государства, полностью применяющие шенгенские правила в отчётном году. Хорватия присутствует начиная с файла за 2023 год. Болгария и Румыния — начиная с файла за 2024 год; согласно этому файлу, их данные на этом листе относятся к периоду после 31 марта 2024 года.',
  'method.coverage.national':
    'Национальные краткосрочные визы, выданные Болгарией, Хорватией и Румынией до этих дат, а также Кипром во все годы, публикуются на отдельном листе и не учитываются.',
  'method.coverage.other':
    'Ирландия в источнике не представлена: она проводит собственную визовую политику. Лихтенштейн не выдаёт собственных шенгенских виз и в источнике не указан.',
  'method.coverage.listed':
    'Государства Шенгенской зоны на листе источника — по первому году в этом наборе данных:',
  'method.missing.title': 'Пропуски',
  'method.missing.text':
    'Пустая ячейка источника показана как «нет данных» и не считается нулём. При суммировании пустые ячейки пропускаются, а в подробностях выборки указано, сколько ячеек было пусто. Доля показана как «нет данных», если пусто одно из нужных для неё чисел или делитель равен нулю.',
  'method.names.title': 'Названия городов',
  'method.names.text':
    'Названия городов соответствуют источнику. Если в файлах один город назван двумя способами, данные показаны под одним названием:',
  'method.checks.title': 'Проверки',
  'method.checks.text':
    'Программа обработки сверяет строки с итогами, напечатанными в каждом файле, и останавливается при расхождении. Одно расхождение внутри файла за 2024 год (строка «Total worldwide» для выданных LTV) записано в отчёте о проверках.',
  'method.checks.link': 'Отчёт о проверках (JSON)',
  'method.map.title': 'Карта',
  'method.map.text':
    'Границы взяты из Natural Earth (world-atlas, 1:50m) и показаны только для ориентира. Они не выражают позиции о правовом статусе каких-либо территорий или границ.',
  'method.download.title': 'Данные',
  'method.download.text': 'Обработанные таблицы, на которых построен сайт:',
  'method.download.files': 'Файлы-источники по годам:',

  'download.consulate_year': 'Консульства по годам (CSV)',
  'download.country_state_year': 'Страны по государствам Шенгенской зоны и годам (CSV)',
  'download.country_year': 'Страны по годам (CSV)',
  'download.state_year': 'Государства Шенгенской зоны по годам, семь стран вместе (CSV)',
  'download.total_year': 'Семь стран вместе по годам (CSV)',
  'download.reporting_states': 'Государства Шенгенской зоны на листе источника по годам (CSV)',

  'footer.source':
    'Источник: Европейская комиссия, «Short-stay visas issued by Schengen countries».',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, ru };

/** Replace `{name}` placeholders; a missing parameter is a programming error. */
export function fillTemplate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`missing parameter "${name}" for "${template}"`);
    return String(value);
  });
}
