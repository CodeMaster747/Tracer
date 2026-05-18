export function cn(
  ...classes: Array<string | false | null | undefined | 0>
): string {
  return classes.filter(Boolean).join(' ');
}

export function formatMm(value: number): string {
  return `${value.toFixed(1)}mm`;
}
