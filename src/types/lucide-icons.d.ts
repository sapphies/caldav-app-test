/**
 * TypeScript declarations for lucide-react tree-shakable icon imports.
 * 
 * This enables importing from 'lucide-react/icons/*' paths which are
 * resolved by Vite to individual ESM files for proper tree-shaking.
 * 
 * Usage: import LoaderCircle from 'lucide-react/icons/loader-circle';
 */

declare module 'lucide-react/icons/*' {
  import { LucideIcon } from 'lucide-react';
  const Icon: LucideIcon;
  export default Icon;
}
