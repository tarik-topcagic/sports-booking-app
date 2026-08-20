export const MONTH_ABBREVIATION_KEYS = [
  'monthAbbrJan',
  'monthAbbrFeb',
  'monthAbbrMar',
  'monthAbbrApr',
  'monthAbbrMay',
  'monthAbbrJun',
  'monthAbbrJul',
  'monthAbbrAug',
  'monthAbbrSep',
  'monthAbbrOct',
  'monthAbbrNov',
  'monthAbbrDec',
];

export const WEEKDAY_ABBREVIATION_KEYS = [
  'weekdayAbbrSun',
  'weekdayAbbrMon',
  'weekdayAbbrTue',
  'weekdayAbbrWed',
  'weekdayAbbrThu',
  'weekdayAbbrFri',
  'weekdayAbbrSat',
];

export function getMonthAbbreviationKey(date: Date): string {
  return MONTH_ABBREVIATION_KEYS[date.getMonth()];
}

export function getWeekdayAbbreviationKey(date: Date): string {
  return WEEKDAY_ABBREVIATION_KEYS[date.getDay()];
}
