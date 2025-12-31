# 10x-cards

10x-cards is a web app that lets IT professionals quickly create and review flashcards for tech and language learning, using AI or manual input, with smart tracking and spaced repetition.

[![version](https://img.shields.io/badge/version-0.0.1-blue.svg)](#)
[![node](https://img.shields.io/badge/node-22.17.0-339933?logo=node.js)](#)
[![status](https://img.shields.io/badge/status-MVP_in_progress-yellow.svg)](#)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Table of contents

- [10x-cards](#10x-cards)
  - [Table of contents](#table-of-contents)
  - [Project description](#project-description)
  - [Tech stack](#tech-stack)
  - [Getting started locally](#getting-started-locally)
  - [Available scripts](#available-scripts)
  - [Testing strategy](#testing-strategy)
    - [Unit and Integration Tests](#unit-and-integration-tests)
    - [End-to-End Tests](#end-to-end-tests)
  - [Test Environment Configuration](#test-environment-configuration)
  - [Project scope](#project-scope)
  - [Project status](#project-status)
  - [License](#license)

## Project description

**10x-cards** is a web application designed to help IT professionals quickly create high-quality flashcards for learning technologies and foreign languages.

It offers two ways to create flashcards:

- AI Generation – automatically generates cards from pasted text.

- Manual Addition – lets users create individual cards manually.

Each flashcard is reviewed, edited, and saved with metadata (author, source, dates, categories, tags) and integrated with a spaced repetition system.

The app uses email/password authentication with RLS restrictions in Supabase. It limits generation requests (max 5 per user per hour) and validates flashcard content. KPIs are tracked on a separate dashboard.

## Tech stack

**✨ Frontend**: Astro 5 • React 19 • TypeScript 5 • Tailwind CSS 4 • Shadcn/ui

**🗄️ Backend**: Supabase (PostgreSQL, Auth, RLS)

**🤖 AI**: OpenRouter (multi-model access, budget controls)

**🚀 CI/CD & Hosting**: GitHub Actions • DigitalOcean (Docker)

**🧪 Testing**: Vitest • Playwright • React Testing Library • MSW • Axe-core

**🧰 Tooling** : ESLint • 9 Prettier (Astro plugin) • Husky • lint-staged

## Getting started locally

Get up and running in a couple of minutes:

1. Clone the repository:

   ```bash
   git clone https://github.com/JoannaMikul/10x-cards
   ```

2. Use the project's Node version

   The required Node version is defined in `.nvmrc`. Currently it's **22.17.0**.

   ```bash
   nvm use
   ```

3. Install dependencies

   ```bash
   npm install
   ```

4. Configure environment variables

   Create a **.env** file in the project root with:

   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_DEFAULT_MODEL=your_preferred_openrouter_model
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

5. Start the dev server

   Go to `http://localhost:3000` in your browser to see the application running.

   ```bash
   npm run dev
   ```

6. Build and preview:

   ```bash
   npm run build
   npm run preview
   ```

- 💡 Notes:
  - Without valid `OPENROUTER_API_KEY` and Supabase credentials, the app starts, but AI and authenticated features are disabled.
  - Tailwind 4 and Astro are already configured—no extra setup needed.

## Available scripts

- **`npm run dev`**: Start the development server
- **`npm run build`**: Build the production bundle
- **`npm run preview`**: Preview the production build locally
- **`npm run astro`**: Run Astro CLI directly
- **`npm run lint`**: Lint the codebase
- **`npm run lint:fix`**: Lint and attempt to fix issues
- **`npm run format`**: Format files with Prettier
- **`npm run test`**: Run unit and integration tests with Vitest
- **`npm run test:e2e`**: Run end-to-end tests with Playwright
- **`npm run test:ui`**: Open Vitest UI for interactive test debugging

## Testing strategy

The application uses a comprehensive testing approach to ensure quality and reliability:

### Unit and Integration Tests

- **Vitest** – Fast unit test runner optimized for Vite/Astro with native TypeScript/ESM support
- **React Testing Library** – Testing React components following best practices (testing behavior, not implementation)
- **@testing-library/user-event** – Realistic user interaction simulations
- **@testing-library/jest-dom** – Custom DOM matchers for better assertions
- **MSW (Mock Service Worker)** – HTTP mocking for API and Supabase in tests and development
  - Global MSW server setup in `src/test/setup.ts` with basic API handlers
  - Organized mock structure: handlers in `src/lib/mocks/handlers/`, data in `src/lib/mocks/mocks/`
  - Admin KPI mocks fully integrated, others available in `src/lib/mocks/mocks/*.api.mocks.ts`
  - Override handlers per test using `server.use()` for specific scenarios

**Coverage focus**:

- Zod validation schemas (`src/lib/validation/*.ts`)
- Domain services (`src/lib/services/*.ts`)
  - Data projection services (e.g., `generation-projection.service.ts` - pure functions for API response shaping)
- Custom hooks and utilities
- AI integration logic (`openrouter-service.ts`)
- Spaced repetition calculations (SuperMemo integration)

### End-to-End Tests

- **Playwright** – Browser-based E2E testing with support for multiple browsers (Chromium, Firefox, WebKit)
- **@axe-core/playwright** – Automated accessibility testing integrated with E2E scenarios
- **dotenv** – Environment variable management for test configuration

**Test scenarios**:

- Full user flows: registration → login → AI generation → candidate review → flashcard management → review sessions
- Admin panel functionality (KPIs, categories, tags, sources, error logs)
- Error handling and edge cases
- Responsive design across desktop, tablet, and mobile viewports

## Test Environment Configuration

For E2E tests, create a `.env.test` file in the project root with test-specific environment variables:

```env
# Test environment configuration
TEST_BASE_URL=http://localhost:3000
SUPABASE_URL=###
SUPABASE_KEY=###
OPENROUTER_API_KEY=###
OPENROUTER_DEFAULT_MODEL=###
SUPABASE_SERVICE_ROLE_KEY=###
E2E_USERNAME_ID=###
E2E_USERNAME=###
E2E_PASSWORD=###
```

The Playwright configuration automatically loads variables from `.env.test` using dotenv, allowing you to:

- Use different base URLs for different test environments (development, staging, production)
- Configure test-specific timeouts and settings
- Manage test user credentials securely

## Project scope

In scope for the MVP (per PRD):

- Implementing automatic flashcard generation using AI based on user-provided text.
- Providing a review flow for AI-generated suggestions with quick edit, accept, or discard options before saving.
- Enabling manual creation of flashcards from scratch.
- Developing a module for browsing and organizing flashcards with search, filters, categories, and tags.
- Implementing a spaced-repetition system to surface the right cards at the right time.
- Setting up user registration and authentication to keep collections private and secure.
- Building a simple dashboard that displays statistics on AI suggestion acceptance and the number of AI-generated flashcards.

Out of scope for the MVP (per PRD):

- No custom spaced repetition algorithm (an existing module is used).
- No file imports other than plain text.
- No sharing of flashcard sets between users.
- No integrations with external educational platforms.
- No mobile apps.
- No timers or time limits in the review process.

## Project status

The project is in the MVP stage and is currently being developed.

## License

This project is open‑source under the MIT License. See the LICENSE file for details.
