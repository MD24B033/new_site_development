export interface CleanLinesOptions {
  footerSubstrings?: string[];

  footerRegexes?: RegExp[];

  stripBarePageNumbers?: boolean;
}

const DEFAULT_OPTIONS: Required<CleanLinesOptions> = {
  footerSubstrings: [
    "Physics of Medical Imaging, rupsabh@iitm.ac.in",
  ],
  footerRegexes: [
    /\d+\s+\|\s+\[footer text here\]/,
  ],
  stripBarePageNumbers: true,
};

export function cleanLines(
  rawPage: string,
  options: CleanLinesOptions = {}
): string[] {
  const mergedOptions: Required<CleanLinesOptions> = {
    footerSubstrings: options.footerSubstrings ?? DEFAULT_OPTIONS.footerSubstrings,
    footerRegexes: options.footerRegexes ?? DEFAULT_OPTIONS.footerRegexes,
    stripBarePageNumbers:
      options.stripBarePageNumbers ?? DEFAULT_OPTIONS.stripBarePageNumbers,
  };

  return rawPage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      if (
        mergedOptions.footerSubstrings.some((substr) =>
          line.includes(substr)
        )
      ) {
        return false;
      }

      if (mergedOptions.footerRegexes.some((re) => re.test(line))) {
        return false;
      }

      if (mergedOptions.stripBarePageNumbers && /^\d+$/.test(line)) {
        return false;
      }

      return true;
    });
}
