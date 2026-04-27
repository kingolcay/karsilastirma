export function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) {
      continue;
    }

    const key = part.slice(2);
    const value = argv[i + 1];
    args[key] = value;
    i += 1;
  }

  const start = args.start;
  const end = args.end;
  const adult = Number(args.adult || 2);

  if (!start || !end) {
    throw new Error("Kullanim: npm start -- --start 2026-05-01 --end 2026-05-04 --adult 2");
  }

  if (!Number.isInteger(adult) || adult <= 0) {
    throw new Error("--adult pozitif tam sayi olmali.");
  }

  return { start, end, adult };
}
