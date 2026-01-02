/**
 * calculate the relative luminance of a color to determine appropriate contrast text color
 * uses the standard relative luminance formula from WCAG guidelines
 */
export const getContrastTextColor = (hexColor: string): string => {
  // handle cases where color might be invalid
  if (!hexColor || !hexColor.startsWith('#')) {
    return '#ffffff';
  }

  try {
    // convert hex to RGB
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);

    // calculate relative luminance using standard formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // return black text for bright colors, white for dark
    return luminance > 0.5 ? '#000000' : '#ffffff';
  } catch {
    // fallback to white text if parsing fails
    return '#ffffff';
  }
};

/**
 * generate a consistent color for a tag based on its name
 */
export const generateTagColor = (name: string) => {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];
  
  // simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
}