import fs from "fs";
import path from "path";

export function saveJSON(name: string, data: any) {
  fs.writeFileSync(path.join(process.cwd(), name), JSON.stringify(data, null, 2));
}

export function uniqBy<T>(arr: T[], keyFn: (x: T) => string) {
  const map = new Map<string, T>();
  for (const item of arr) map.set(keyFn(item), item);
  return Array.from(map.values());
}
