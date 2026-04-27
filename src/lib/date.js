export function formatDateForAgency(input) {
  const [year, month, day] = input.split("-");
  return `${day}.${month}.${year}`;
}
