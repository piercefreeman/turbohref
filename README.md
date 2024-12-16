# turbohref

Turbohref is a modern alternative to [Turbolinks](https://github.com/turbolinks/turbolinks)[^1]. It removes legacy
dependencies so it can be used in any server side project. It's written from the ground-up in TypeScript for better type
safety and maintainability.

Key architecture differences from the original:
- Remove Rails requirements for server side import. It's now a standalone npm package.
- No jQuery dependency; switch to modern ES6 syntax with polyfills.
- Convert codebase to TypeScript for better type safety and maintainability.

Note that while Turbohref was inspired by Turbolinks, it's a totally separate codebase that's been written from scratch. It implements a subset of functionality only.

## Architecture

Turbohref is built around several core components that work together to provide seamless page transitions:

### Core Components

1. **TurboHref**: The main entry point and orchestrator that initializes and coordinates all other components.

2. **NavigationManager**: Handles page navigation and state management
   - Manages the navigation lifecycle (visit requests, history updates)
   - Provides a progress bar for visual feedback during page loads
   - Handles request cancellation for concurrent navigations
   - Supports streaming responses with progress tracking
   - Customizable request options through event hooks

3. **PageManager**: Responsible for DOM updates and content management
   - Supports both full and partial page updates
   - Preserves permanent elements during page transitions
   - Handles script execution and deduplication
   - Manages scroll position restoration
   - Supports selective content updates through data attributes

4. **ClickHandler**: Intercepts and processes link clicks
   - Handles link click interception with configurable rules
   - Filters out external links, downloads, and modified clicks
   - Supports opt-out through data attributes

5. **Events**: Type-safe event system for component communication
   - Provides strongly-typed event definitions
   - Supports event cancellation and modification
   - Enables extensibility through custom event handlers

### Key Features

- **Partial Page Updates**: Selectively update portions of the page using `data-turbohref-refresh` attributes
- **Permanent Elements**: Preserve specific elements during navigation using `data-turbohref-permanent`
- **Progress Tracking**: Visual feedback during page loads with customizable progress bar
- **Request Customization**: Modify requests through the `BeforeRequest` event
- **Script Management**: Intelligent script execution with deduplication and opt-out options
- **History Management**: Seamless integration with browser history and back/forward navigation

### Data Flow

1. User clicks a link or programmatically triggers navigation
2. ClickHandler intercepts the click and triggers a visit event
3. NavigationManager:
   - Cancels any in-flight requests
   - Initiates new page fetch with progress tracking
   - Handles request customization through events
4. PageManager:
   - Processes the new page content
   - Updates the DOM (full or partial)
   - Manages script execution
   - Handles scroll position
5. Events system notifies components of state changes

### Extension Points

- Custom request headers and options through `BeforeRequest` event
- Selective content updates using data attributes
- Script execution control via `data-turbohref-eval-false`
- Event hooks for navigation lifecycle (BeforeVisit, Visit, Error, etc.)

## Installation

```bash
npm install turbohref
```

If you're using vanilla Javascript, you can import the library module using something like:

```javascript
<script type="module">
    import { TurboHref } from 'turbohref';
    const turbo = new TurboHref();
    turbo.start();
</script>
```

If you're using React, the same logic still holds. You'll want to do this right on page load.

```jsx
import { TurboHref } from 'turbohref';

const Layout = () => {
    useEffect(() => {
        const turbo = new TurboHref();
        turbo.start();
    }, []);
}
```

## Building

```bash
npm run build
```

## Demo Site

We have a simple demo site that can be used for local testing:

```bash
python3 -m http.server 5020
```

Then navigate to:

```
http://localhost:5020/demo-web/demo.html
```
