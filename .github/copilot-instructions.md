# 🧠 Project Coding Guidelines (Spring Boot - Agribridge)

## 🏗️ Architecture

- Follow layered architecture:
  - controller → service → repository → entity
- Do NOT put business logic in controllers
- Controllers only handle request/response

---

## 📦 Package Structure

Use the following package structure:

- config
- controller
- dto
- entity
- repository
- service

---

## 🔗 API Design

- Use RESTful conventions
- Base path: `/api/{resource}`

Examples:
- GET `/api/complaints`
- POST `/api/complaints`
- GET `/api/complaints/{id}`
- PUT `/api/complaints/{id}`
- DELETE `/api/complaints/{id}`

---

## 📥 DTO Rules

- ALWAYS use DTO for request/response
- DO NOT expose Entity directly in API
- Use naming:
  - `CreateXxxDto`
  - `UpdateXxxDto`
  - `XxxResponseDto`

---

## 🧾 Entity Rules

- Use `@Entity` and `@Table`
- Use `@Id` + `@GeneratedValue(strategy = GenerationType.IDENTITY)`
- Use `@Enumerated(EnumType.STRING)` for enums
- DO NOT use database-specific columnDefinition unless necessary
- Use `LocalDateTime` for timestamps

---

## 🔁 Mapping

- Map DTO ↔ Entity in service layer
- Do NOT map inside controller

---

## 🧠 Service Rules

- All business logic must be in service layer
- Service methods should be small and reusable
- Use meaningful method names:
  - createXxx
  - updateXxx
  - deleteXxx
  - getXxxById

---

## 🗄️ Repository Rules

- Use Spring Data JPA
- Extend `JpaRepository`
- Do NOT write unnecessary custom queries

---

## ⚠️ Exception Handling

- Use `@RestControllerAdvice`
- Return consistent error response:
```json
{
  "message": "...",
  "errors": {}
}
```

---

## 🎨 Frontend UI Coding Rules (AGRIBRIDGE-FE)

### 1) Frontend Architecture

- Use layered FE flow: `pages` → `components` → `services` → `types/data`
- Keep page files focused on composition and screen-level state only
- Put reusable UI in `src/components/**`
- Put API/network logic only in `src/services/**` (no fetch logic inside UI components)
- Put shared type definitions in `src/types/**`

---

### 2) File Naming & Structure

- Use `PascalCase` for React component files: `BuyerDashboardPage.tsx`, `MarketPriceSection.tsx`
- Use `camelCase` for data/service/helper files: `homeService.ts`, `buyerOrdersData.ts`
- One main component per file
- Keep components small and single-purpose
- Group UI by domain folder (`buyer`, `supplier`, `site`, `onboarding`, `public`)

---

### 3) Component Rules

- Use functional components with TypeScript
- Define explicit `Props` type/interface for every component receiving props
- Avoid `any`; prefer exact union/interface types
- Move hardcoded text/constants to `src/data/**` when reused
- Do NOT put complex business logic in JSX; extract to helper functions
- Prefer composition over deeply nested conditional rendering

---

### 4) Styling Rules (Tailwind + CSS)

- Prefer Tailwind utility classes for layout/spacing/typography
- Use component-level CSS files only when Tailwind is not sufficient
- Keep className readable: group by layout → spacing → color → state
- Use design tokens/colors consistently (avoid random one-off color codes)
- Ensure responsive behavior for mobile/tablet/desktop (`sm`, `md`, `lg`, `xl`)
- Keep consistent spacing scale and border radius across screens

---

### 5) UX & Accessibility

- All images must have meaningful `alt`
- All buttons/inputs must have accessible labels
- Ensure keyboard focus visibility for interactive elements
- Use semantic HTML (`main`, `section`, `nav`, `button`, `form`, `label`)
- Do not rely on color only to communicate state
- Loading/error/empty states are required for data-driven screens

---

### 6) API/Data Handling in UI

- Call backend through `src/services/apiClient.ts` and service wrappers
- Keep API response mapping in service layer, not inside visual components
- Use typed response models from `src/types/**`
- Handle loading/error in page-level container and pass clean data to child components
- Never expose raw backend error objects directly to UI

---

### 7) State Management Rules

- Keep local UI state close to the component that uses it
- Lift state up only when multiple child components share it
- Derived UI state should be computed, not duplicated
- Avoid prop drilling across many levels; extract shared logic/component boundaries

---

### 8) Reusability Standards

- Repeated UI pattern (card, badge, section header, status chip) must be extracted into reusable component
- Repeated formatter logic (date, currency, status label) must be extracted into helper function
- Prefer configurable props over copy-paste variants

---

### 9) Quality Checklist Before Commit (Frontend)

- No TypeScript errors
- No ESLint errors
- No unused imports/variables
- Responsive UI checked at mobile and desktop widths
- All async screens have loading + error + empty states
- New component follows naming/location conventions above

---

### 10) Frontend Do/Don't

- DO keep pages clean and delegate reusable parts to components
- DO keep API/service logic separate from presentation
- DO keep code typed and predictable
- DON'T mix mock data and API data in the same render flow without clear separation
- DON'T place direct fetch calls in presentational components
- DON'T create oversized components with multiple responsibilities

---

### 11) Shared UI Standard (AGRIBRIDGE-FE)

- Use `Inter` as the default font for all screens, forms, tables, and dialogs
- New UI should inherit typography from `src/index.css` and Tailwind `font-sans`
- Keep one common screen rhythm:
  - page title and subtitle
  - action buttons on the right
  - small green summary/count text above filters
  - filter bar
  - content grid or list
- Use `text-xs font-semibold text-emerald-700` for the summary/count line above filters
- Keep related cards visually consistent across screens in the same workflow
- Product cards and lot cards should share the same image height, title scale, spacing, radius, and value emphasis when they appear in the supplier flow
- Prefer compact dashboard cards:
  - rounded 2xl
  - white background
  - light border
  - compact padding
- Every new data-driven screen must include loading, error, and empty states
- Reuse existing components before creating one-off visual variants
