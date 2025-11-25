/**
 * Format enum string values to title case with spaces
 * Example: "in_progress" -> "In Progress"
 * Example: "this_is_the_new_format" -> "This Is The New Format"
 */
export function formatEnumValue(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
