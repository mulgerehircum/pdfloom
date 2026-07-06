// Curated Google Fonts list — the single source of truth for the editor's font picker
// (see TemplatesController.getFonts), the DTO's validation, and the compiler's Google Fonts
// <link> + font-family sanitization. Adding a font means adding one entry here; nowhere else.
export interface GoogleFont {
  name: string;
  // Google Fonts CSS2 API family param (spaces become '+') — https://fonts.googleapis.com/css2?family=...
  googleFamily: string;
}

export const GOOGLE_FONTS: GoogleFont[] = [
  { name: 'Roboto', googleFamily: 'Roboto' },
  { name: 'Inter', googleFamily: 'Inter' },
  { name: 'Open Sans', googleFamily: 'Open+Sans' },
  { name: 'Lato', googleFamily: 'Lato' },
  { name: 'Montserrat', googleFamily: 'Montserrat' },
  { name: 'Merriweather', googleFamily: 'Merriweather' },
  { name: 'Playfair Display', googleFamily: 'Playfair+Display' },
  { name: 'Source Sans 3', googleFamily: 'Source+Sans+3' },
  { name: 'Poppins', googleFamily: 'Poppins' },
  { name: 'JetBrains Mono', googleFamily: 'JetBrains+Mono' },
];

export const GOOGLE_FONT_NAMES = GOOGLE_FONTS.map((f) => f.name);

export function findGoogleFont(name?: string): GoogleFont | undefined {
  return name ? GOOGLE_FONTS.find((f) => f.name === name) : undefined;
}
