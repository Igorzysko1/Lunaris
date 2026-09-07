// Konfiguracja płaska (ESLint 9). Baza z eslint-config-expo — zna React Native,
// expo-router i JSX — plus wyłączenie reguł stylistycznych, którymi zajmuje się
// Prettier, żeby nie ścierały się z formatowaniem.

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      // Wygenerowana baza miejscowości: 3520 linii danych, nie kod do czytania.
      'src/data/places.generated.ts',
    ],
  },
  {
    // Reguła TypeScriptowa musi trafić tam, gdzie wtyczka jest zarejestrowana —
    // w konfiguracji Expo dotyczy wyłącznie plików .ts/.tsx.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Nieużyta zmienna to zwykle pomyłka, ale świadomie pominięty argument
      // (`(_, i) => …`) i pominięte pole przy destrukturyzacji to nie błąd.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Warstwa domenowa i skrypty CLI chodzą pod Node, a nie w Metro.
    files: ['scripts/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
]);
