# Product: Work Organizer

Desktop application for organizing work notes with AI-powered categorization. Users capture quick text entries during their workday, and the app automatically categorizes them into projects, classifies their type and action status, and rewrites them for clarity.

## Core Features

- **Quick Capture**: Free-text input that gets AI-categorized into projects, entry types, and action items
- **Projects & Entries**: Entries are organized by project with types (information, decision, request, idea, blocker, update) and action statuses
- **Review Inbox**: AI suggestions go through a review workflow (auto_approved, pending, approved, corrected)
- **Kanban Tasks**: Tasks derived from entries with statuses (todo, in_progress, waiting, done)
- **Daily Digest**: AI-generated summary shown on app start with overdue tasks, yesterday's activity, and suggestions
- **Global Search**: Ctrl+K search across entries, tasks, and projects
- **AI Summaries**: Per-project and global executive summaries

## AI Integration

Uses AWS Bedrock Converse API (Claude Sonnet) via API Key auth for:
- Entry categorization and text improvement
- Task suggestion from entries
- Project and global summaries
- Daily digest generation

## Language

The app UI and AI prompts are in **Brazilian Portuguese**. Keep all user-facing strings, labels, and AI system prompts in Portuguese.
