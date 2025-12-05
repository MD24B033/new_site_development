export function cleanLines(rawPage: string): string[] {
  return rawPage
    .split(/\r?\n/)         
    .map(line => line.trim()) 
    .filter(line => line.length > 0); 
}