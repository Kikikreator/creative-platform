---
description: Design, audit, improve, or build websites with a
  professional, natural, modern, clean, human-centered UI. Use this
  skill whenever the user asks to create, redesign, review, or modify a
  website, dashboard, admin panel, web app, or UI component. Prevent
  generic AI-template aesthetics, unnecessary text, excessive cards,
  decorative labels, and visual clutter while preserving existing
  functionality.
name: professional-human-centered-web-design
---

# Professional Human-Centered Web Design

## Purpose

Create and improve websites that feel intentionally designed by an
experienced product design and engineering team. The result must be
natural, clear, modern, restrained, functional, and appropriate to the
product's real users.

Do not try to make a website look "human-made" by adding random
imperfections. Professional quality comes from deliberate design
decisions, useful content, coherent visual hierarchy, authentic product
context, and reliable implementation.

This skill applies to landing pages, SaaS products, dashboards, admin
panels, portals, learning platforms, e-commerce interfaces, and other
web applications.

## Core principles

1.  **Purpose before decoration.** Every visible element must help users
    understand information, navigate, decide, or complete a task.
2.  **Remove before adding.** When a page feels crowded, first remove
    redundant text, labels, cards, icons, borders, and repeated actions.
    Do not add more components to solve clutter.
3.  **Content earns its space.** If a sentence does not provide
    necessary context or help the user act, remove it.
4.  **Different pages have different jobs.** Do not force every page
    into the same layout or dashboard template.
5.  **Consistency without monotony.** Reuse a coherent design system,
    but choose layouts and components according to each page's purpose.
6.  **Functionality is mandatory.** A visually polished screenshot is
    not a finished product if controls, forms, filters, navigation,
    permissions, or data operations do not work.
7.  **Preserve working systems.** Avoid unrelated changes to business
    logic, database schemas, authentication, permissions, APIs, and
    existing features.

## 1. Language and interface copy

Use the user's requested language as the primary interface language. For
Indonesian projects, use clear, natural, professional Bahasa Indonesia.

### Mandatory rules

-   Do not add decorative English eyebrow labels above page titles.
-   Avoid repeated labels such as:
    -   ADMINISTRATOR WORKSPACE
    -   OVERVIEW
    -   INSTRUCTOR MANAGEMENT
    -   STUDENT SUBMISSIONS
    -   LEARNING MANAGEMENT
    -   USER MANAGEMENT
    -   CONTENT MANAGEMENT
-   Do not add a subtitle or explanatory paragraph to every page
    heading.
-   Do not repeat the page name, role, or product identity when it is
    already obvious from the navigation or surrounding context.
-   Do not explain what an obvious button does in a paragraph.
-   Do not add slogans, marketing copy, motivational statements, or
    generic filler to operational interfaces.
-   Do not use tiny text merely to fill empty space or create visual
    texture.
-   Avoid unnecessary uppercase labels and excessive letter spacing.
-   Keep labels concise and specific.
-   Use helper text only when it prevents confusion or an input error.
-   Use tooltips only for controls whose purpose is not self-evident.
-   Preserve established product names, brand names, technical terms,
    and user-provided wording where appropriate.

### Copy test

For every sentence, ask:

1.  Does the user need this information to understand the page?
2.  Is the same information already visible elsewhere?
3.  Does this sentence help the user make a decision or complete an
    action?

If the sentence does not pass at least one of these tests, remove it.

## 2. Page headers

-   Prefer a simple page title.
-   Add a short description only when the page's purpose cannot be
    understood from the title and visible content.
-   Place the primary action near the title when that is the clearest
    workflow.
-   Avoid decorative eyebrow text, repeated workspace labels, and
    redundant role labels.
-   Keep header height and spacing proportionate.
-   Do not force identical header compositions on pages with different
    needs.

Example:

Preferred: `Manajemen Mentor`

Avoid: `ADMINISTRATOR WORKSPACE` `Manajemen Mentor`
`Kelola akun dengan akses Mentor aktif, tetapkan kelas, dan atur kesepakatan bagi hasil.`

The description may be retained only if it communicates genuinely
necessary information not available elsewhere.

## 3. Cards, containers, and surfaces

Cards are optional components, not a default wrapper for every section.

-   Do not wrap every group of information in a card.
-   Avoid cards inside cards.
-   Do not turn every table, list, form, heading, and statistic into a
    separate bordered box.
-   Use a simple page section, table, list, divider, or whitespace when
    that is clearer.
-   Use cards when they create meaningful grouping, comparison,
    emphasis, or separation.
-   Avoid excessive borders, shadows, backgrounds, and nested
    containers.
-   Do not give every component the same corner radius.
-   Avoid making the entire interface look like a grid of boxes.
-   Do not add a card merely to make a page look more modern.

Choose the simplest component that communicates the information clearly.

## 4. Statistics and summary metrics

Statistics are not mandatory on every page.

-   Use dashboard metrics when they help users understand platform
    health or make decisions.
-   Do not force four or five statistic cards onto every management
    page.
-   Do not create metrics solely because the page has room.
-   Avoid prominent zero-value cards when they add no useful
    information.
-   Do not split a small set of related numbers into many separate
    cards.
-   Consider a compact inline summary when only two or three values are
    needed.
-   Do not repeat counts already clearly visible in a table, filter, or
    list.
-   Use charts only when they reveal a meaningful pattern or support
    analysis.
-   Never invent production statistics or display dummy values as real
    data.

Page-specific guidance: - Main dashboard: relevant platform-wide metrics
may be useful. - Mentor management: show mentor totals or assignment
status only when they support administration. - Material management:
show chapter and material counts compactly or contextually; avoid a row
of unnecessary metric cards. - Task management: show task counts only
when they help the workflow. - Submission review: prioritize
submissions, search, and status filters over decorative metric cards. -
Class management: show class totals or publication states only when
useful.

## 5. Descriptions, instructions, and helper text

-   Do not add a description to every section.
-   Do not repeat the function of a button in nearby prose.
-   Do not provide long instructions for simple actions.
-   Avoid generic text such as "Kelola seluruh data dengan mudah melalui
    halaman ini" when it adds no information.
-   Do not repeat guidance already shown elsewhere on the page.
-   Keep system feedback short and actionable.
-   Use confirmation dialogs for consequential or hard-to-reverse
    actions, not for every click.
-   Explain errors in plain language and state what the user can do
    next.

## 6. Buttons, icons, badges, and interactive components

-   Use a clear hierarchy for primary, secondary, and destructive
    actions.
-   Avoid excessive pill-shaped buttons.
-   Do not use badges for every piece of metadata.
-   Use status badges only when they make a state easier to recognize.
-   Do not add an icon to every section heading.
-   Use icons only when they improve recognition or reduce reading
    effort.
-   Do not use emoji as a substitute for a professional interface icon.
-   Avoid gradient buttons and decorative icon containers without a
    clear design reason.
-   Do not show duplicate buttons for the same action in the same
    context.
-   Do not style a static element as interactive.
-   Provide visible hover, focus, disabled, loading, and error states
    where appropriate.
-   Ensure keyboard focus is visible and controls are accessible.

## 7. Layout, spacing, and visual hierarchy

-   Design each page around its primary user task.
-   Do not force every page into a three-column card layout.
-   Do not reuse one generic dashboard composition everywhere.
-   Avoid excessive nested visual layers.
-   Use whitespace deliberately to group content and establish
    hierarchy.
-   Do not fill empty space with unnecessary components.
-   Avoid both overcrowding and arbitrary emptiness.
-   Keep alignment, spacing, and content widths consistent.
-   Make the primary action and most important information easy to find.
-   Use tables and lists for data-heavy tasks when they are more
    efficient than cards.
-   Use responsive grids only when the content benefits from comparison
    or grouping.

## 8. Empty states

Keep empty states concise and useful.

Preferred example:

`Belum ada materi.` `Tambah Materi`

Rules: - State clearly that no data is available. - Provide one relevant
primary action when appropriate. - Avoid large decorative illustrations
unless they serve a real purpose. - Avoid long instructional
paragraphs. - Do not duplicate a primary action that is already
prominent nearby. - Do not turn an empty state into a promotional
section.

## 9. Typography and color

-   Use a restrained, readable type scale.
-   Avoid too many font families, sizes, weights, and text colors.
-   Do not make every heading oversized or every sentence bold.
-   Maintain readable contrast and line height.
-   Use color to communicate hierarchy, status, and brand identity.
-   Avoid generic purple-blue-pink gradients as an automatic design
    choice.
-   Do not assign a different bright background to every component.
-   Keep status colors consistent.
-   Respect the existing brand identity unless the user asks to change
    it.
-   Never sacrifice legibility for a fashionable visual effect.

## 10. Visual style and common generic-template patterns

Avoid using these patterns automatically or excessively:

-   Gradient backgrounds across large parts of the application.
-   Glassmorphism on ordinary admin panels.
-   Floating blobs, glowing orbs, abstract 3D shapes, and decorative
    lines without a product purpose.
-   Identical rounded cards for every data group.
-   Excessive shadows and borders.
-   Repeated centered headings followed by three cards.
-   Identical section patterns on every route.
-   Excessive tiny uppercase labels.
-   Decorative icons beside every heading.
-   Unnecessary animations and hover effects.
-   Stock illustrations unrelated to the product.
-   Generic hero copy and unsupported marketing claims.

These patterns are not universally forbidden. Use them only when they
fit the product, brand, content, and user needs. Never apply them by
default.

## 11. Navigation and information architecture

-   Use familiar, concise navigation labels.
-   Use the interface's primary language.
-   Keep menu groups meaningful.
-   Do not add menu items or submenus without real functionality.
-   Make the current location clear.
-   Avoid duplicating navigation in multiple places without a reason.
-   Preserve established routes and navigation behavior unless a change
    is requested.
-   Do not rename existing routes or menu items casually.

## 12. Responsive behavior and accessibility

-   Design for desktop, tablet, and mobile.
-   Do not merely shrink the desktop layout to fit a phone.
-   Give sidebars an appropriate mobile behavior.
-   Make tables usable on small screens through an appropriate
    responsive strategy.
-   Keep touch targets practical.
-   Prevent text clipping, overlap, and unintended horizontal scrolling.
-   Maintain adequate contrast, semantic HTML, keyboard navigation, and
    visible focus states.
-   Respect reduced-motion preferences.
-   Test realistic viewport sizes when the environment permits.

## 13. Functional and technical quality

-   Every visible button, link, menu, filter, tab, form, and action must
    work as presented.
-   Do not leave decorative or non-functional controls.
-   Validate forms and show useful error messages.
-   Provide loading, success, failure, and empty states where relevant.
-   Make search, sorting, filtering, pagination, and CRUD operations
    genuinely functional when shown.
-   Use real application data in production; do not disguise dummy data
    as real.
-   Do not expose secrets, service-role keys, or sensitive data in
    frontend code.
-   Respect authentication, authorization, and row-level security.
-   Avoid unnecessary dependencies and oversized assets.
-   Keep code maintainable and consistent with the existing project
    architecture.
-   Check console errors and broken routes when possible.

## 14. Preserve existing projects

When modifying an existing website:

1.  Inspect the current project structure and relevant files before
    editing.
2.  Understand the current page, data flow, routes, and component
    dependencies.
3.  Identify exactly which parts the user asked to change.
4.  Preserve unrelated behavior and working features.
5.  Do not redesign or rewrite the whole application when a focused
    change is sufficient.
6.  Do not alter database schemas, migrations, authentication,
    permissions, API contracts, or business logic without a clear
    requirement.
7.  Do not replace working code with a speculative implementation.
8.  Keep existing integrations and environment configuration intact.
9.  If a change may affect other pages or workflows, inspect those
    dependencies before proceeding.
10. Test the changed flow and relevant neighboring flows after
    implementation.
11. Report any unverified behavior honestly.

If the user says "do not change anything else", treat that as a strict
scope constraint.

## 15. Required workflow before designing or coding

Before implementation, follow this sequence:

### Step 1 --- Understand the page

Identify: - Who uses this page? - What is the user's primary task? -
What information is essential? - What actions must be available? - What
data and permissions govern the page?

### Step 2 --- Choose the simplest suitable structure

Decide whether the page needs: - A title only or a title with a short
description. - A primary action. - A table, list, form, cards, or a
combination. - Statistics or no statistics. - Filters, search, tabs, or
pagination. - Empty, loading, error, and success states.

Do not include a component simply because it is common in dashboard
templates.

### Step 3 --- Remove unnecessary content

Remove: - Decorative English labels. - Redundant descriptions. -
Repeated instructions. - Duplicate actions. - Unnecessary cards and
metric panels. - Decorative icons, badges, and helper text. - Visual
elements that do not support a user task.

### Step 4 --- Implement with restraint

Use the existing design system where appropriate. Keep the result
visually coherent, responsive, accessible, and functional.

### Step 5 --- Audit before completion

Review the result against the checklist below. Fix issues before
reporting completion.

## 16. Mandatory final audit checklist

### Content

-   [ ] No unnecessary English eyebrow labels above page titles.
-   [ ] No redundant descriptions or repeated instructions.
-   [ ] No filler text or unnecessary tiny labels.
-   [ ] Interface language is consistent.
-   [ ] No fake statistics, testimonials, or production content.

### Visual design

-   [ ] Cards are used only where useful.
-   [ ] No unnecessary nested cards.
-   [ ] Statistics are justified by the page's purpose.
-   [ ] No excessive gradients, shadows, borders, badges, or icons.
-   [ ] No decorative elements added merely to fill space.
-   [ ] Whitespace and hierarchy are balanced.
-   [ ] Page layout suits its actual workflow.

### Functionality

-   [ ] All visible controls work.
-   [ ] Forms and validation work.
-   [ ] Search and filters work when present.
-   [ ] Loading, empty, and error states are handled where relevant.
-   [ ] Existing features and data flows remain intact.
-   [ ] No known broken routes or unresolved runtime errors.

### Quality

-   [ ] Desktop and mobile layouts are usable.
-   [ ] Text is readable and accessible.
-   [ ] No clipped or overlapping elements.
-   [ ] Changes stay within the requested scope.
-   [ ] Unverified items are disclosed rather than claimed as complete.

## 17. Expected response when using this skill

When asked to design or modify a website:

1.  Briefly identify the intended scope.
2.  Inspect the supplied code, screenshots, or project files when
    available.
3.  Make the requested changes rather than merely describing what should
    be changed, when implementation is possible.
4.  Preserve existing functionality and state any necessary assumptions.
5.  Summarize what changed, what was tested, and what remains
    unverified.
6.  Do not claim that a feature works unless it has actually been tested
    or otherwise verified.

## Final design rule

**Do not make a website look professional by adding more elements. Make
it professional by choosing the right elements and removing everything
that does not deserve to be there.**

The target is a natural, modern, clean, product-specific interface:
minimal without being empty, informative without being crowded,
consistent without being repetitive, and visually polished without
relying on generic AI-template effects.
