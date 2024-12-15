// src/ClickHandler.ts
var _ClickHandler = class {
  constructor() {
    this.boundClickHandler = this.handleClick.bind(this);
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
      this.triggerEvent("turbohref:click", { url: url.toString(), link });
    }
  }
  findLinkFromClickTarget(event) {
    const target = event.target;
    const link = target.closest(_ClickHandler.CLICK_SELECTOR);
    return link;
  }
  triggerEvent(name, detail = {}) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail
    });
    return document.dispatchEvent(event);
  }
};
var ClickHandler = _ClickHandler;
ClickHandler.CLICK_SELECTOR = "a[href]:not([target]):not([download]):not([data-turbohref-ignore])";

// src/NavigationManager.ts
var NavigationManager = class {
  constructor(pageManager, options = {}) {
    this.currentRequest = null;
    this.pageManager = pageManager;
    this.isTestEnvironment = typeof process !== "undefined" && process.env.NODE_ENV === "test";
    this.color = options.color || "rgb(0, 118, 255)";
    this.height = options.height || 3;
    this.progressBar = this.createProgressBar();
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
    window.addEventListener("turbohref:click", (event) => {
      this.visit(event.detail.url);
    });
    document.addEventListener("turbohref:before-render", () => {
      this.showProgress();
    });
    document.addEventListener("turbohref:render", () => {
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
    if (!this.triggerEvent("turbohref:before-visit", { url })) {
      return;
    }
    if (this.currentRequest) {
      this.currentRequest.abort();
    }
    this.currentRequest = new AbortController();
    try {
      const response = await this.fetchPage(url, this.currentRequest.signal);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      await this.pageManager.update(doc, options);
      if (!options.partialReplace) {
        window.history.pushState({ turbohref: true }, "", url);
      }
      this.triggerEvent("turbohref:visit", { url });
      if (options.callback) {
        options.callback();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      this.triggerEvent("turbohref:error", { error });
      if (this.isTestEnvironment) {
        this.triggerEvent("turbohref:fallback-navigation", { url });
      } else {
        window.location.href = url;
      }
    } finally {
      this.currentRequest = null;
    }
  }
  async fetchPage(url, signal) {
    return fetch(url, {
      method: "GET",
      headers: {
        "Accept": "text/html, application/xhtml+xml",
        "X-Requested-With": "TurboHref"
      },
      credentials: "same-origin",
      signal
    });
  }
  handlePopState(event) {
    var _a;
    if ((_a = event.state) == null ? void 0 : _a.turbohref) {
      this.visit(window.location.href);
    }
  }
  triggerEvent(name, detail = {}) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail
    });
    return document.dispatchEvent(event);
  }
};

// src/PageManager.ts
var _PageManager = class {
  constructor() {
    this.executedScripts = /* @__PURE__ */ new Set();
    this.mounted = false;
    this.clickHandler = null;
    this.trackExistingScripts();
  }
  mount() {
    if (this.mounted) {
      return;
    }
    this.clickHandler = (event) => {
    };
    document.addEventListener("click", this.clickHandler);
    this.mounted = true;
  }
  unmount() {
    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    this.mounted = false;
  }
  async update(newDocument, options = {}) {
    console.log("Starting page update...", {
      partialReplace: options.partialReplace,
      onlyKeys: options.onlyKeys,
      exceptKeys: options.exceptKeys
    });
    this.unmount();
    this.triggerEvent("turbohref:before-render");
    if (options.partialReplace) {
      console.log("Performing partial update...");
      await this.performPartialUpdate(newDocument, options);
    } else {
      console.log("Performing full page update...");
      await this.performFullUpdate(newDocument);
    }
    this.triggerEvent("turbohref:render");
    this.executeScripts();
    this.updateScrollPosition();
    console.log("Page update complete");
    this.mount();
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
  triggerEvent(name, detail = {}) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail
    });
    return document.dispatchEvent(event);
  }
};
var PageManager = _PageManager;
PageManager.PERMANENT_SELECTOR = "[data-turbohref-permanent]";

// src/TurboHref.ts
var _TurboHref = class {
  constructor() {
    this.clickHandler = new ClickHandler();
    this.pageManager = new PageManager();
    this.navigationManager = new NavigationManager(this.pageManager);
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
    this.triggerEvent("turbohref:ready");
  }
  stop() {
    this.clickHandler.stop();
    this.navigationManager.stop();
  }
  visit(url, options = {}) {
    this.navigationManager.visit(url, options);
  }
  triggerEvent(name, detail = {}) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail
    });
    return document.dispatchEvent(event);
  }
};
var TurboHref = _TurboHref;
TurboHref.instance = null;
export {
  TurboHref
};
