const dateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Date must use YYYY-MM-DD.");
  const parts = match.slice(1).map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    throw new Error("Invalid date.");
  }
  return parts as [number, number, number];
};

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDayIsoRange(value: string) {
  const [year, month, day] = dateParts(value);
  return {
    dateFrom: new Date(year, month - 1, day, 0, 0, 0, 0).toISOString(),
    dateTo: new Date(year, month - 1, day, 23, 59, 59, 999).toISOString(),
  };
}

function zurichMidnight(year: number, month: number, day: number) {
  // Swiss DST switches at 01:00 UTC, so the offset at UTC midnight equals the offset at Zurich midnight.
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(utcMidnight);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const zurichAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"));
  return new Date(utcMidnight.getTime() - (zurichAsUtc - utcMidnight.getTime()));
}

// Start and end instants of a Europe/Zurich calendar day, independent of the server time zone.
export function zurichDayRange(value: string) {
  const [year, month, day] = dateParts(value);
  return {
    start: zurichMidnight(year, month, day),
    end: new Date(zurichMidnight(year, month, day + 1).getTime() - 1),
  };
}

export function parsePosDateBoundary(value: string, end = false) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = dateParts(value);
    return new Date(
      year,
      month - 1,
      day,
      end ? 23 : 0,
      end ? 59 : 0,
      end ? 59 : 0,
      end ? 999 : 0
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("Date must be an ISO timestamp or use YYYY-MM-DD.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}
