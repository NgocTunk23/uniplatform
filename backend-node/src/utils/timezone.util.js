const TIME_ZONE = 'Asia/Bangkok';

const DATE_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const formatToGMT7 = (date) => {
  if (!date) return date;
  const parsedDate = date instanceof Date ? date : new Date(date);
  const formatted = DATE_FORMATTER.format(parsedDate).replace(' ', 'T');
  return `${formatted}+07:00`;
};

const normalizeDates = (value) => {
  if (value instanceof Date) {
    return formatToGMT7(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeDates);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = normalizeDates(val);
      return acc;
    }, {});
  }

  return value;
};

module.exports = {
  TIME_ZONE,
  formatToGMT7,
  normalizeDates,
};
