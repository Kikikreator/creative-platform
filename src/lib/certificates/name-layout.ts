export type CertificateNameLayout = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
};

/**
 * Fits a participant name inside the configured certificate name box.
 *
 * Behaviour:
 * - Short/medium names stay on one line and use the largest comfortable size.
 * - Long names prefer a balanced two-line layout before becoming too small.
 * - Extremely long single words are reduced in size instead of being clipped.
 *
 * `measureText` must return the rendered width for a given font size. The same
 * helper is used by the browser preview and PDF renderer so both stay aligned.
 */
export function fitCertificateName(
  rawName: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  minFontSize: number,
  measureText: (text: string, size: number) => number,
): CertificateNameLayout {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  const safeWidth = Math.max(1, maxWidth);
  const safeHeight = Math.max(1, maxHeight);
  const minimum = Math.max(6, Math.min(minFontSize, maxFontSize));
  const maximum = Math.max(minimum, maxFontSize);
  const step = 0.5;
  const heightLimit = safeHeight * 0.88;

  const findFit = (lines: string[], upper: number): CertificateNameLayout | null => {
    for (let size = upper; size >= minimum; size -= step) {
      const lineHeight = size * 1.14;
      const blockHeight = lineHeight * lines.length;
      if (blockHeight > heightLimit) continue;
      if (lines.every((line) => measureText(line, size) <= safeWidth)) {
        return { lines, fontSize: size, lineHeight };
      }
    }
    return null;
  };

  if (!name) {
    const size = Math.min(maximum, safeHeight * 0.55);
    return { lines: ['Nama Peserta'], fontSize: size, lineHeight: size * 1.14 };
  }

  const words = name.split(' ').filter(Boolean);
  const oneLineUpper = Math.min(maximum, safeHeight * 0.72);
  const oneLine = findFit([name], oneLineUpper);

  // Build the most balanced two-line split using actual font width rather than
  // character count, so names with wide letters are handled more accurately.
  let bestLines: string[] | null = null;
  if (words.length > 1) {
    let bestScore = Number.POSITIVE_INFINITY;
    for (let splitAt = 1; splitAt < words.length; splitAt += 1) {
      const first = words.slice(0, splitAt).join(' ');
      const second = words.slice(splitAt).join(' ');
      const firstWidth = measureText(first, 1);
      const secondWidth = measureText(second, 1);
      const balancePenalty = Math.abs(firstWidth - secondWidth) * 0.08;
      const score = Math.max(firstWidth, secondWidth) + balancePenalty;
      if (score < bestScore) {
        bestScore = score;
        bestLines = [first, second];
      }
    }
  }

  // Do not force every multi-word name onto two lines. Prefer two lines only
  // when a one-line rendering would need to shrink below 72% of its available
  // comfortable size. This keeps short names large while making long names,
  // such as "Ahmad zaindin warisi admin", naturally wrap into two centered rows.
  const shouldPreferTwoLines = Boolean(
    bestLines && (!oneLine || oneLine.fontSize < oneLineUpper * 0.72),
  );

  if (shouldPreferTwoLines && bestLines) {
    const twoLineUpper = Math.min(maximum, safeHeight * 0.38);
    const twoLine = findFit(bestLines, twoLineUpper);
    if (twoLine) return twoLine;
  }

  if (oneLine) return oneLine;

  if (bestLines) {
    const twoLineUpper = Math.min(maximum, safeHeight * 0.38);
    const twoLine = findFit(bestLines, twoLineUpper);
    if (twoLine) return twoLine;

    // Emergency fallback: preserve all words and reduce below the configured
    // minimum rather than clipping or silently dropping part of the name.
    for (let size = Math.min(twoLineUpper, minimum - step); size >= 5; size -= step) {
      const lineHeight = size * 1.14;
      if (lineHeight * 2 > heightLimit) continue;
      if (bestLines.every((line) => measureText(line, size) <= safeWidth)) {
        return { lines: bestLines, fontSize: size, lineHeight };
      }
    }
    return { lines: bestLines, fontSize: 5, lineHeight: 5.7 };
  }

  // A single unusually long token has no safe word boundary. Shrink it instead
  // of cutting a person's name in the middle.
  for (let size = Math.min(oneLineUpper, minimum - step); size >= 5; size -= step) {
    if (measureText(name, size) <= safeWidth && size * 1.14 <= heightLimit) {
      return { lines: [name], fontSize: size, lineHeight: size * 1.14 };
    }
  }

  return { lines: [name], fontSize: 5, lineHeight: 5.7 };
}
