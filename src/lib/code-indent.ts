export function indentCode(
  text: string,
  start: number,
  end: number,
  outdent: boolean,
) {
  start = Math.max(0, Math.min(text.length, start));
  end = Math.max(start, Math.min(text.length, end));
  if (start === end && !outdent)
    return {
      text: text.slice(0, start) + '  ' + text.slice(end),
      start: start + 2,
      end: end + 2,
    };
  const first = text.lastIndexOf('\n', start - 1) + 1;
  // A selection ending at the next line's start does not include that line.
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const lineEnd = text.indexOf('\n', last);
  const boundary = lineEnd < 0 ? text.length : lineEnd;
  let shift = 0;
  let firstShift = 0;
  const replacement = text
    .slice(first, boundary)
    .split('\n')
    .map((line, index) => {
      const removed = outdent
        ? line.match(/^(?: {1,2}|\t)/)?.[0].length || 0
        : 0;
      const delta = outdent ? -removed : 2;
      shift += delta;
      if (index === 0) firstShift = delta;
      return outdent ? line.slice(removed) : '  ' + line;
    })
    .join('\n');
  return {
    text: text.slice(0, first) + replacement + text.slice(boundary),
    start: Math.max(first, start + firstShift),
    end: Math.max(first, end + shift),
  };
}
