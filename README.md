# turbohref

Turbohref is a modern alternative to [Turbolinks](https://github.com/turbolinks/turbolinks)[^1]. It removes legacy
dependencies so it can be used in any server side project. It's written from the ground-up in TypeScript for better type
safety and maintainability.

Key architecture differences from the original:
- Remove Rails requirements for server side import. It's now a standalone npm package.
- No jQuery dependency; switch to modern ES6 syntax with polyfills.
- Convert codebase to TypeScript for better type safety and maintainability.

Note that while Turbohref was inspired by Turbolinks, it's a totally separate codebase that's been written from scratch. It implements a subset of functionality only.

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
