# Implementation Plan: i18n Multi-Language

## Overview

Implement internationalization support for SideBrain using i18next + react-i18next with bundled JSON translation resources. The implementation adds two locales (pt-BR as default/fallback, en), 8 namespaces, locale-aware formatting utilities, a Language Selector in Settings, and replaces all hardcoded strings in renderer components with `t()` calls. Property-based tests with fast-check validate 10 correctness properties.

## Tasks

- [x] 1. Install dependencies and set up i18n infrastructure
  - [x] 1.1 Install i18next, react-i18next, and fast-check (dev)
    - Run `npm install i18next react-i18next` and `npm install -D fast-check`
    - Verify packages are added to package.json
    - _Requirements: 3.1, 8.1_

  - [x] 1.2 Add `language` field to AppSettings shared type
    - Edit `src/shared/types/settings.ts` to add `language: string` field
    - Set default value to `'pt-BR'` in `DEFAULT_SETTINGS`
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.3 Create i18next initialization module
    - Create `src/renderer/i18n/index.ts` with `initI18n(locale?)` function
    - Define `SUPPORTED_LOCALES`, `SupportedLocale` type, and `isValidLocale` guard
    - Configure: fallbackLng `pt-BR`, 8 namespaces, defaultNS `common`, escapeValue false
    - _Requirements: 1.6, 2.6, 3.3, 3.6_

  - [x] 1.4 Create translation resource aggregator
    - Create `src/renderer/i18n/resources.ts` that imports all JSON files and exports the `resources` object
    - Structure: `{ 'pt-BR': { common, dashboard, ... }, en: { common, dashboard, ... } }`
    - _Requirements: 3.1, 3.2_

- [x] 2. Create Portuguese (pt-BR) translation files
  - [x] 2.1 Create pt-BR common and dashboard namespaces
    - Create `src/renderer/locales/pt-BR/common.json` with shared strings (save, cancel, delete, confirm, search, loading, error, success, plural forms)
    - Create `src/renderer/locales/pt-BR/dashboard.json` with Dashboard component strings
    - Extract all hardcoded Portuguese strings from `Dashboard.tsx` and shared UI elements
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 Create pt-BR settings and capture namespaces
    - Create `src/renderer/locales/pt-BR/settings.json` with Settings component strings
    - Create `src/renderer/locales/pt-BR/capture.json` with CaptureInput component strings
    - Extract all hardcoded Portuguese strings from `Settings.tsx` and `CaptureInput.tsx`
    - _Requirements: 6.1, 6.2_

  - [x] 2.3 Create pt-BR projects, meetings, reports, and chat namespaces
    - Create `src/renderer/locales/pt-BR/projects.json` with ProjectList/ProjectView strings
    - Create `src/renderer/locales/pt-BR/meetings.json` with MeetingMode strings
    - Create `src/renderer/locales/pt-BR/reports.json` with Reports strings
    - Create `src/renderer/locales/pt-BR/chat.json` with SmartChat strings
    - _Requirements: 6.1, 6.2_

- [x] 3. Create English (en) translation files
  - [x] 3.1 Create en common and dashboard namespaces
    - Create `src/renderer/locales/en/common.json` matching all keys from pt-BR common
    - Create `src/renderer/locales/en/dashboard.json` matching all keys from pt-BR dashboard
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.2 Create en settings and capture namespaces
    - Create `src/renderer/locales/en/settings.json` matching all keys from pt-BR settings
    - Create `src/renderer/locales/en/capture.json` matching all keys from pt-BR capture
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.3 Create en projects, meetings, reports, and chat namespaces
    - Create `src/renderer/locales/en/projects.json` matching all keys from pt-BR projects
    - Create `src/renderer/locales/en/meetings.json` matching all keys from pt-BR meetings
    - Create `src/renderer/locales/en/reports.json` matching all keys from pt-BR reports
    - Create `src/renderer/locales/en/chat.json` matching all keys from pt-BR chat
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. Checkpoint - Verify translation infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create formatting utilities
  - [x] 5.1 Implement locale-aware formatting functions
    - Create `src/renderer/utils/formatting.ts`
    - Implement `formatDate(date, locale, options?)` using `Intl.DateTimeFormat`
    - Implement `formatNumber(value, locale, options?)` using `Intl.NumberFormat`
    - Implement `formatStructuredDate(date, format)` for explicit date format patterns
    - Handle invalid date passthrough (return original string) and non-numeric passthrough
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.2 Write property tests for formatting utilities
    - **Property 8: Locale-Aware Number Formatting**
    - **Property 9: Explicit Date Format Override**
    - **Property 10: Invalid Value Passthrough**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

- [x] 6. Integrate i18n into React app
  - [x] 6.1 Wire i18n initialization into app entry point
    - Edit `src/renderer/main.tsx` to import `./i18n/index` before React render
    - Load language from settings via `electronAPI.getSettings()` before calling `initI18n(locale)`
    - _Requirements: 1.3, 2.5_

  - [x] 6.2 Add I18nextProvider to App.tsx
    - Wrap `AppProvider` content with `I18nextProvider` passing the i18n instance
    - Handle invalid locale fallback on startup (overwrite DB with pt-BR if invalid)
    - _Requirements: 1.3, 1.6, 2.5, 8.4_

  - [x] 6.3 Add Language Selector to Settings component
    - Add a language selection dropdown in Settings under Appearance tab
    - Display options in native names: "Português (Brasil)", "English"
    - On change: call `i18n.changeLanguage(locale)`, persist via `electronAPI.updateSettings({ language })`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

- [x] 7. Replace hardcoded strings in core components
  - [x] 7.1 Migrate Dashboard and ActivityBar components
    - Add `useTranslation('dashboard')` to Dashboard
    - Replace all hardcoded Portuguese strings with `t()` calls
    - Migrate `ActivityBar.tsx` and `Sidebar.tsx` using `common` namespace
    - _Requirements: 6.1, 6.2, 8.1, 8.2_

  - [x] 7.2 Migrate CaptureInput and ProjectList/ProjectView components
    - Add `useTranslation('capture')` and `useTranslation('projects')` respectively
    - Replace all hardcoded strings in `CaptureInput.tsx`, `ProjectList.tsx`, `ProjectView.tsx`
    - Use interpolation for dynamic values (counts, names)
    - _Requirements: 4.1, 4.2, 6.1, 6.2, 8.1, 8.2_

  - [x] 7.3 Migrate Settings, MeetingMode, and Reports components
    - Add `useTranslation('settings')`, `useTranslation('meetings')`, `useTranslation('reports')`
    - Replace all hardcoded strings in these components
    - _Requirements: 6.1, 6.2, 8.1, 8.2_

  - [x] 7.4 Migrate SmartChat, ErrorCenter, and remaining components
    - Add `useTranslation('chat')` to SmartChat
    - Migrate `ErrorCenter.tsx`, `NotificationCenter.tsx`, `DailyDigest.tsx`, `GlobalSearch.tsx`, `AboutModal.tsx`, `OnboardingFlow.tsx`, `ConnectionGraph.tsx`, `CustomFieldsSettings.tsx`
    - Migrate `App.tsx` tab titles (getTabTitle) and status bar text
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 8.1, 8.2_

- [x] 8. Checkpoint - Verify full i18n integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Property-based tests for i18n core logic
  - [x] 9.1 Write property test for locale persistence round-trip
    - **Property 1: Locale Persistence Round-Trip**
    - **Validates: Requirements 1.1, 1.3, 1.5, 2.4, 2.5**

  - [x] 9.2 Write property test for invalid locale fallback
    - **Property 2: Invalid Locale Fallback**
    - **Validates: Requirements 1.6, 2.6**

  - [x] 9.3 Write property test for translation key fallback chain
    - **Property 3: Translation Key Fallback Chain**
    - **Validates: Requirements 3.3, 3.4, 6.4, 8.5**

  - [x] 9.4 Write property test for namespace-qualified key resolution
    - **Property 4: Namespace-Qualified Key Resolution**
    - **Validates: Requirements 3.6, 8.2**

  - [x] 9.5 Write property test for interpolation replacement
    - **Property 5: Interpolation Replacement**
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [x] 9.6 Write property test for plural form selection
    - **Property 6: Plural Form Selection**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 9.7 Write property test for translation key parity between locales
    - **Property 7: Translation Key Parity Between Locales**
    - **Validates: Requirements 7.3**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript (matching the existing codebase and design examples)
- pt-BR translations should exactly match current hardcoded Portuguese strings to ensure zero regression
- English translations must cover 100% of keys present in pt-BR files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.2"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] }
  ]
}
```
