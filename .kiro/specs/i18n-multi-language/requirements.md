# Requirements Document

## Introduction

This feature adds internationalization (i18n) support to SideBrain, enabling the application to be used in multiple languages. The initial implementation supports English (en) and Brazilian Portuguese (pt-BR), with pt-BR as the default language (maintaining current behavior). Users can switch the UI language from Settings, and the selected preference persists across sessions.

## Glossary

- **I18n_System**: The internationalization module responsible for loading, storing, and providing translated strings to the UI components.
- **Locale**: A language identifier code (e.g., `en`, `pt-BR`) representing the user's chosen language.
- **Translation_File**: A structured JSON file containing all translated strings for a given locale, organized by namespace.
- **Translation_Key**: A unique string identifier used to reference a translatable text (e.g., `settings.save`).
- **Namespace**: A logical grouping of translation keys by feature area (e.g., `dashboard`, `settings`, `capture`).
- **Language_Selector**: The UI control in the Settings page that allows the user to choose the active language.
- **Fallback_Locale**: The locale used when a translation key is missing in the active locale. Defaults to `pt-BR`.
- **Interpolation**: The mechanism for inserting dynamic values into translated strings (e.g., `"Olá, {{name}}"` → `"Olá, Leandro"`).

## Requirements

### Requirement 1: Language Preference Storage

**User Story:** As a user, I want SideBrain to remember my language preference, so that the app always opens in my chosen language.

#### Acceptance Criteria

1. THE I18n_System SHALL store the selected locale as a setting in the application database with key `language` and value being one of the supported Locale codes (`en` or `pt-BR`).
2. WHEN the application starts and no language setting exists, THE I18n_System SHALL default to `pt-BR` as the active locale.
3. WHEN the application starts and a language setting exists with a supported locale value, THE I18n_System SHALL render all translatable UI text using the stored locale before displaying the main window.
4. THE I18n_System SHALL support exactly two locales: `en` and `pt-BR`.
5. WHEN the user selects a locale from the language options, THE I18n_System SHALL persist the selected value to the database and apply it to all translatable UI text without requiring an application restart.
6. IF the stored language setting contains a value other than `en` or `pt-BR`, THEN THE I18n_System SHALL fall back to `pt-BR` as the active locale and overwrite the invalid stored value with `pt-BR`.

### Requirement 2: Language Switching

**User Story:** As a user, I want to switch the application language from Settings, so that I can use SideBrain in my preferred language.

#### Acceptance Criteria

1. THE Language_Selector SHALL be displayed in the Settings page under the Appearance tab.
2. THE Language_Selector SHALL offer at minimum the following locales: Português (Brasil) [pt-BR] and English [en].
3. WHEN the user selects a different locale from the Language_Selector, THE I18n_System SHALL apply the new locale to all static UI text (labels, menu items, button text, placeholder text, and tooltips) within 500 milliseconds, without requiring an application restart.
4. WHEN the user selects a different locale, THE I18n_System SHALL persist the new locale value to the application settings store.
5. WHEN the application starts, THE I18n_System SHALL load the persisted locale from settings and apply it before rendering the main window content.
6. IF the persisted locale value is missing or does not match any supported locale, THEN THE I18n_System SHALL fall back to pt-BR as the default locale.
7. THE Language_Selector SHALL display each language option in its own native name (e.g., "English", "Português (Brasil)").

### Requirement 3: Translation File Structure

**User Story:** As a developer, I want translations organized by namespace, so that they are easy to maintain and extend.

#### Acceptance Criteria

1. THE I18n_System SHALL load translations from JSON files located at `src/renderer/locales/{locale}/{namespace}.json`, where each JSON file contains a flat or nested key-value structure with string values only.
2. THE I18n_System SHALL support organizing translation keys into namespaces corresponding to feature areas (e.g., `common`, `dashboard`, `settings`, `capture`, `projects`, `meetings`, `reports`, `chat`), where each namespace maps to exactly one JSON file per locale.
3. WHEN a Translation_Key is missing in the active locale, THE I18n_System SHALL fall back to the corresponding key in the Fallback_Locale (`pt-BR`) and display the fallback value without any visible error to the user.
4. IF a Translation_Key is missing in both the active locale and the Fallback_Locale, THEN THE I18n_System SHALL display the raw Translation_Key string (in the format `namespace:keyPath`) as a visual indicator of the missing translation.
5. WHEN the I18n_System loads a namespace, IF the corresponding JSON file does not exist or contains invalid JSON, THEN THE I18n_System SHALL log a warning and treat the namespace as empty without crashing the application.
6. THE I18n_System SHALL reference translation keys using the format `{namespace}:{key}` (e.g., `common:save`, `dashboard:title`), where the namespace prefix determines which JSON file to look up.

### Requirement 4: String Interpolation

**User Story:** As a developer, I want to include dynamic values in translated strings, so that translations can contain variable content like names, counts, and dates.

#### Acceptance Criteria

1. THE I18n_System SHALL support interpolation using double curly brace syntax (e.g., `{{variableName}}`), where placeholder names consist of 1 to 64 alphanumeric or underscore characters.
2. WHEN a translated string contains interpolation placeholders and corresponding dynamic values are provided, THE I18n_System SHALL replace each placeholder with the string representation of its provided value within 5ms per translation call.
3. IF a required interpolation value is not provided, THEN THE I18n_System SHALL display the placeholder text unchanged (e.g., `{{name}}`) without throwing an error.
4. WHEN a translated string contains multiple placeholders (up to 20 per string), THE I18n_System SHALL replace all occurrences of each placeholder independently, including repeated uses of the same placeholder.
5. IF a provided interpolation value is null or undefined, THEN THE I18n_System SHALL render an empty string in place of the placeholder.

### Requirement 5: Pluralization

**User Story:** As a developer, I want to handle plural forms correctly, so that strings like "1 task" vs "2 tasks" display properly in each language.

#### Acceptance Criteria

1. THE I18n_System SHALL support plural forms using a count-based approach with keys suffixed by `_one` and `_other` (e.g., `tasks_one`: "{{count}} tarefa", `tasks_other`: "{{count}} tarefas"), where count equal to 1 selects the `_one` form and any other count value (including 0 and negative numbers) selects the `_other` form for both `en` and `pt-BR` locales.
2. WHEN the translation function is called with a count parameter and plural-suffixed keys exist for the given Translation_Key, THE I18n_System SHALL select the correct plural form by appending the appropriate suffix (`_one` or `_other`) to the base key based on the count value.
3. IF a count parameter is provided but the required plural-suffixed key (e.g., `_one` or `_other`) is missing in the Translation_File, THEN THE I18n_System SHALL fall back to the `_other` form if available, or display the base Translation_Key itself if no plural form is found.
4. IF the translation function is called on a plural-suffixed key without providing a count parameter, THEN THE I18n_System SHALL default to the `_other` form.

### Requirement 6: Complete Portuguese Translation Coverage

**User Story:** As a user who speaks Portuguese, I want all existing UI text to remain available in Portuguese, so that my experience is unchanged after the i18n feature is implemented.

#### Acceptance Criteria

1. THE I18n_System SHALL provide Translation_Files for `pt-BR` containing translation keys for 100% of user-facing text strings currently hardcoded in the application's renderer components.
2. WHEN the locale is set to `pt-BR`, THE I18n_System SHALL display all UI text with content identical to the current hardcoded Portuguese strings, with zero visible differences in wording or formatting.
3. THE I18n_System SHALL use `pt-BR` as the Fallback_Locale, so that any missing translation key in another locale resolves to the `pt-BR` value rather than displaying a raw key or empty string.
4. WHEN a translation key is missing from the active locale's Translation_File, THE I18n_System SHALL display the corresponding `pt-BR` fallback value within the same render cycle, without visual flicker or layout shift.
5. IF a Translation_File fails to load at application startup, THEN THE I18n_System SHALL fall back to the bundled `pt-BR` Translation_File and display an error indicator in the settings area informing the user that locale loading failed.

### Requirement 7: English Translation Coverage

**User Story:** As an English-speaking user, I want to use SideBrain entirely in English, so that I can understand all interface elements.

#### Acceptance Criteria

1. THE I18n_System SHALL provide Translation_Files for `en` covering all user-facing text in the application, including labels, buttons, placeholders, tooltips, error messages, and notification messages.
2. WHEN the locale is set to `en`, THE I18n_System SHALL display all UI text in English with no untranslated or hardcoded Portuguese strings visible in the interface.
3. THE English Translation_Files SHALL cover the same set of Translation_Keys as the Portuguese Translation_Files, with zero missing keys.
4. IF a Translation_Key is present in the Portuguese Translation_File but absent in the English Translation_File, THEN THE I18n_System SHALL fall back to displaying the Translation_Key identifier instead of blank text.

### Requirement 8: Translation Hook for React Components

**User Story:** As a developer, I want a simple API to access translations in React components, so that integrating i18n is straightforward and consistent.

#### Acceptance Criteria

1. THE I18n_System SHALL provide a React hook named `useTranslation` that returns a translation function `t` and the current active locale string.
2. WHEN a component calls the `t` function with a Translation_Key, THE I18n_System SHALL return the translated string for the active locale by looking up the key in the loaded translation resource for that locale.
3. THE `t` function SHALL accept an optional interpolation object where each key corresponds to a placeholder token delimited by `{{` and `}}` in the translation string, and an optional numeric `count` parameter that selects the appropriate plural form (singular when count equals 1, plural otherwise) for the active locale.
4. WHEN the active locale changes, THE I18n_System SHALL trigger a re-render of all mounted components that use the `useTranslation` hook, causing them to display strings in the new locale.
5. IF the `t` function is called with a Translation_Key that does not exist in the active locale's translation resource, THEN THE I18n_System SHALL return the Translation_Key itself as a fallback string.

### Requirement 9: Date and Number Formatting

**User Story:** As a user, I want dates and numbers formatted according to my selected language, so that the display matches my regional conventions.

#### Acceptance Criteria

1. WHEN rendering a date in descriptive context (e.g., relative time labels, month-day displays in digests or reports), THE I18n_System SHALL format dates using the active locale's conventions (e.g., "Jan 15, 2025" for `en`, "15 jan. 2025" for `pt-BR`), applying the `Intl.DateTimeFormat` API with the current locale identifier.
2. THE I18n_System SHALL format numbers using the active locale's decimal and thousand separators (e.g., `1,234.56` for `en`, `1.234,56` for `pt-BR`) for all numeric displays including counts, statistics, and usage values.
3. WHILE the user's date format setting (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) is set explicitly, THE I18n_System SHALL use that setting instead of locale-inferred defaults for all structured date displays (date columns, timestamps, due dates, and date pickers).
4. IF no explicit date format setting has been configured by the user, THEN THE I18n_System SHALL default to DD/MM/YYYY as the structured date format.
5. IF a date value is invalid or unparseable, THEN THE I18n_System SHALL display the original raw string unchanged. IF a number value is non-numeric, THEN THE I18n_System SHALL display the original raw value unchanged.
