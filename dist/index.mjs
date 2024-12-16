// src/events.ts
var TurboEvent = /* @__PURE__ */ ((TurboEvent2) => {
  TurboEvent2["BeforeVisit"] = "turbohref:before-visit";
  TurboEvent2["Visit"] = "turbohref:visit";
  TurboEvent2["BeforeRender"] = "turbohref:before-render";
  TurboEvent2["Render"] = "turbohref:render";
  TurboEvent2["Error"] = "turbohref:error";
  TurboEvent2["FallbackNavigation"] = "turbohref:fallback-navigation";
  TurboEvent2["Click"] = "turbohref:click";
  TurboEvent2["Ready"] = "turbohref:ready";
  TurboEvent2["BeforeRequest"] = "turbohref:before-request";
  return TurboEvent2;
})(TurboEvent || {});
var Events = class {
  trigger(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail
    });
    return document.dispatchEvent(event);
  }
  on(eventName, handler) {
    document.addEventListener(eventName, handler);
  }
  off(eventName, handler) {
    document.removeEventListener(eventName, handler);
  }
};

// src/click_handler.ts
var _ClickHandler = class {
  constructor() {
    this.boundClickHandler = this.handleClick.bind(this);
    this.events = new Events();
  }
  start() {
    document.addEventListener("click", this.boundClickHandler, true);
  }
  stop() {
    document.removeEventListener("click", this.boundClickHandler, true);
  }
  handleClick(event) {
    const link = this.findLinkFromClickTarget(event);
    if (!link)
      return;
    const url = new URL(link.href);
    const isSameOrigin = url.origin === window.location.origin;
    const isLeftClick = event.button === 0;
    const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (isSameOrigin && isLeftClick && !isModified) {
      event.preventDefault();
      this.events.trigger("turbohref:click" /* Click */, { url: url.toString(), link });
    }
  }
  findLinkFromClickTarget(event) {
    const target = event.target;
    const link = target.closest(_ClickHandler.CLICK_SELECTOR);
    return link;
  }
};
var ClickHandler = _ClickHandler;
ClickHandler.CLICK_SELECTOR = "a[href]:not([target]):not([download]):not([data-turbohref-ignore])";

// src/navigation_manager.ts
var NavigationManager = class {
  constructor(pageManager, options = {}) {
    this.currentRequest = null;
    this.pageManager = pageManager;
    this.isTestEnvironment = typeof process !== "undefined" && process.env.NODE_ENV === "test";
    this.color = options.color || "rgb(0, 118, 255)";
    this.height = options.height || 3;
    this.progressBar = this.createProgressBar();
    this.events = new Events();
  }
  createProgressBar() {
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0%",
      height: `${this.height}px`,
      backgroundColor: this.color,
      transition: "width 0.2s ease",
      zIndex: "9999"
    });
    return bar;
  }
  start() {
    if (!document.body.contains(this.progressBar)) {
      document.body.appendChild(this.progressBar);
    }
    window.addEventListener("popstate", this.handlePopState.bind(this));
    window.addEventListener("turbohref:click" /* Click */, (event) => {
      this.visit(event.detail.url);
    });
    this.events.on("turbohref:before-render" /* BeforeRender */, () => {
      this.showProgress();
    });
    this.events.on("turbohref:render" /* Render */, () => {
      this.completeProgress();
    });
  }
  stop() {
    window.removeEventListener("popstate", this.handlePopState.bind(this));
    this.progressBar.remove();
  }
  showProgress() {
    this.progressBar.style.width = "0%";
    this.progressBar.offsetHeight;
    this.progressBar.style.width = "80%";
  }
  completeProgress() {
    this.progressBar.style.width = "100%";
    setTimeout(() => {
      this.progressBar.style.transition = "width 0.2s ease, opacity 0.2s ease";
      this.progressBar.style.opacity = "0";
      setTimeout(() => {
        this.progressBar.style.width = "0%";
        this.progressBar.style.opacity = "1";
        this.progressBar.style.transition = "width 0.2s ease";
      }, 200);
    }, 200);
  }
  async visit(url, options = {}) {
    if (!this.events.trigger("turbohref:before-visit" /* BeforeVisit */, { url })) {
      return;
    }
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
    const thisRequest = new AbortController();
    this.currentRequest = thisRequest;
    try {
      if (this.currentRequest !== thisRequest) {
        return;
      }
      const response = await this.fetchPage(url, thisRequest.signal);
      if (this.currentRequest !== thisRequest) {
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();
      if (this.currentRequest !== thisRequest) {
        return;
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      await this.pageManager.update(doc, options);
      if (!options.partialReplace) {
        window.history.pushState({ turbohref: true }, "", url);
      }
      this.events.trigger("turbohref:visit" /* Visit */, { url });
      if (options.callback) {
        options.callback();
      }
    } catch (error) {
      if (this.currentRequest !== thisRequest) {
        return;
      }
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      this.events.trigger("turbohref:error" /* Error */, { error });
      if (this.isTestEnvironment) {
        this.events.trigger("turbohref:fallback-navigation" /* FallbackNavigation */, { url });
      } else {
        window.location.href = url;
      }
    } finally {
      if (this.currentRequest === thisRequest) {
        this.currentRequest = null;
      }
    }
  }
  async fetchPage(url, signal) {
    let fetchOptions = {
      method: "GET",
      headers: {
        "Accept": "text/html, application/xhtml+xml",
        "X-Requested-With": "TurboHref"
      },
      credentials: "same-origin",
      signal
    };
    this.events.trigger("turbohref:before-request" /* BeforeRequest */, {
      url,
      options: fetchOptions,
      setOptions: (newOptions) => {
        fetchOptions = {
          ...fetchOptions,
          ...newOptions,
          // Ensure signal can't be overridden
          signal,
          // Merge headers if both exist
          headers: {
            ...fetchOptions.headers,
            ...newOptions.headers || {}
          }
        };
      }
    });
    const response = await fetch(url, fetchOptions);
    const contentLength = response.headers.get("content-length");
    if (!contentLength) {
      return response;
    }
    const total = parseInt(contentLength, 10);
    let loaded = 0;
    const progressBar = this.progressBar;
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            loaded += value.length;
            const progress = loaded / total * 100;
            const adjustedProgress = progress * 0.8;
            progressBar.style.width = `${adjustedProgress}%`;
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
    return new Response(stream, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText
    });
  }
  handlePopState(event) {
    var _a;
    if ((_a = event.state) == null ? void 0 : _a.turbohref) {
      this.visit(window.location.href);
    }
  }
};

// src/page_manager.ts
var _PageManager = class {
  constructor() {
    this.executedScripts = /* @__PURE__ */ new Set();
    this.trackExistingScripts();
    this.events = new Events();
  }
  async update(newDocument, options = {}) {
    console.log("Starting page update...", {
      partialReplace: options.partialReplace,
      onlyKeys: options.onlyKeys,
      exceptKeys: options.exceptKeys
    });
    this.events.trigger("turbohref:before-render" /* BeforeRender */);
    if (options.partialReplace) {
      console.log("Performing partial update...");
      await this.performPartialUpdate(newDocument, options);
    } else {
      console.log("Performing full page update...");
      await this.performFullUpdate(newDocument);
    }
    this.events.trigger("turbohref:render" /* Render */);
    this.executeScripts();
    this.updateScrollPosition();
    console.log("Page update complete");
  }
  trackExistingScripts() {
    const scripts = Array.from(document.getElementsByTagName("script"));
    scripts.forEach((script) => {
      const identifier = this.getScriptIdentifier(script);
      if (identifier) {
        this.executedScripts.add(identifier);
      }
    });
  }
  getScriptIdentifier(script) {
    return script.src || script.textContent || "";
  }
  async performPartialUpdate(newDocument, options) {
    const { onlyKeys = [], exceptKeys = [] } = options;
    if (onlyKeys.length > 0) {
      await this.updateMatchingElements(newDocument, onlyKeys);
    } else if (exceptKeys.length > 0) {
      await this.updateExceptElements(newDocument, exceptKeys);
    }
  }
  async performFullUpdate(newDocument) {
    const permanentElements = document.querySelectorAll(_PageManager.PERMANENT_SELECTOR);
    console.log(`Found ${permanentElements.length} permanent elements to preserve`);
    permanentElements.forEach((element) => {
      const id = element.id;
      if (!id)
        throw new Error("Permanent elements must have an id");
      const newElement = newDocument.getElementById(id);
      if (newElement) {
        console.log(`Preserving permanent element with id: ${id}`);
        newElement.replaceWith(element.cloneNode(true));
      }
    });
    console.log("Replacing entire body content");
    document.body.replaceWith(newDocument.body.cloneNode(true));
    document.head.replaceWith(newDocument.head.cloneNode(true));
    if (newDocument.title !== document.title) {
      console.log(`Updating page title from "${document.title}" to "${newDocument.title}"`);
      document.title = newDocument.title;
    }
  }
  async updateMatchingElements(newDocument, keys) {
    console.log(`Updating elements matching keys:`, keys);
    for (const key of keys) {
      const selector = `[data-turbohref-refresh="${key}"]`;
      const elements = document.querySelectorAll(selector);
      const newElements = newDocument.querySelectorAll(selector);
      console.log(`Found ${elements.length} existing and ${newElements.length} new elements for key "${key}"`);
      elements.forEach((element, index) => {
        const newElement = newElements[index];
        if (newElement) {
          element.replaceWith(newElement.cloneNode(true));
        } else {
          console.warn(`No matching new element found for index ${index} with key "${key}"`);
        }
      });
    }
  }
  async updateExceptElements(newDocument, keys) {
    console.log(`Preserving elements except for keys:`, keys);
    const selectors = keys.map((key) => `[data-turbohref-refresh="${key}"]`);
    const elementsToKeep = document.querySelectorAll(selectors.join(","));
    console.log(`Found ${elementsToKeep.length} elements to preserve`);
    const preserved = /* @__PURE__ */ new Map();
    elementsToKeep.forEach((element) => {
      const id = element.id;
      if (!id)
        throw new Error("Elements to preserve must have an id");
      preserved.set(id, element.cloneNode(true));
    });
    console.log("Replacing body content while preserving selected elements");
    document.body.replaceWith(newDocument.body.cloneNode(true));
    console.log("Restoring preserved elements");
    preserved.forEach((element, id) => {
      const newElement = document.getElementById(id);
      if (newElement) {
        newElement.replaceWith(element);
      } else {
        console.warn(`Could not find element with id "${id}" in new document to restore preserved content`);
      }
    });
  }
  executeScripts() {
    console.log("Executing scripts...");
    const scripts = Array.from(document.getElementsByTagName("script")).filter((script) => !script.hasAttribute("data-turbohref-eval-false"));
    scripts.forEach((script) => {
      var _a;
      const identifier = this.getScriptIdentifier(script);
      console.log("Executing script:", identifier);
      if (this.executedScripts.has(identifier)) {
        return;
      }
      const newScript = document.createElement("script");
      Array.from(script.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = script.textContent;
      this.executedScripts.add(identifier);
      (_a = script.parentNode) == null ? void 0 : _a.replaceChild(newScript, script);
    });
  }
  updateScrollPosition() {
    if (window.location.hash) {
      const element = document.getElementById(window.location.hash.slice(1));
      if (element) {
        element.scrollIntoView();
      }
    } else {
      window.scrollTo(0, 0);
    }
  }
};
var PageManager = _PageManager;
PageManager.PERMANENT_SELECTOR = "[data-turbohref-permanent]";

// src/turbo_href.ts
var _TurboHref = class {
  constructor() {
    this.clickHandler = new ClickHandler();
    this.pageManager = new PageManager();
    this.navigationManager = new NavigationManager(this.pageManager);
    this.events = new Events();
  }
  static getInstance() {
    if (!_TurboHref.instance) {
      _TurboHref.instance = new _TurboHref();
    }
    return _TurboHref.instance;
  }
  start() {
    this.clickHandler.start();
    this.navigationManager.start();
    this.events.trigger("turbohref:ready" /* Ready */);
  }
  stop() {
    this.clickHandler.stop();
    this.navigationManager.stop();
  }
  visit(url, options = {}) {
    this.navigationManager.visit(url, options);
  }
};
var TurboHref = _TurboHref;
TurboHref.instance = null;
export {
  TurboEvent,
  TurboHref
};
