# turbopages

Turbopages is a modern fork of [Turbolinks](https://github.com/turbolinks/turbolinks)[^1]. It removes legacy
dependencies so it can be used in any server side project. It also converts the codebase to TypeScript for better type
safety and maintainability.

Key architecture differences from the original:
- Remove Rails requirements for server side import. It's now a standalone npm package.
- Remove jQuery dependency and switch to modern ES6 syntax with polyfills.
- Convert codebase to TypeScript for better type safety and maintainability.

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

[^1] Specifically the existing [Turbograft](https://github.com/Shopify/turbograft) fork, which did the heavy lifting
of converting from CoffeeScript to Javascript.
