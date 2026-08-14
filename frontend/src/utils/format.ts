/** Convertit un nombre d'octets en taille lisible (ex. "3,1 Ko"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1).replace('.', ',')} ${units[unitIndex]}`;
}

/** Date ISO → format court français (ex. "14/08/2026"). */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(isoDate));
}
