// src/events.ts
var EventManager = class {
  constructor() {
    this.activeDocument = null;
  }
  trigger(name, data) {
    if (!this.activeDocument) {
      throw new Error("Document not set");
    }
    return this.triggerFor(name, this.activeDocument.documentElement, data);
  }
  triggerFor(name, node, data) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail: data
    });
    return node.dispatchEvent(event);
  }
  setDocument(doc) {
    this.activeDocument = doc;
  }
};

// src/turbograft/attributes.ts
var TurboGraftAttributes = class {
  static tgAttribute(attr) {
    if (attr.slice(0, 3) === "tg-") {
      return `data-${attr}`;
    }
    return `data-tg-${attr}`;
  }
  static getTGAttribute(node, attr) {
    const tgAttr = this.tgAttribute(attr);
    return node.getAttribute(tgAttr) || node.getAttribute(attr) || void 0;
  }
  static removeTGAttribute(node, attr) {
    const tgAttr = this.tgAttribute(attr);
    node.removeAttribute(tgAttr);
    node.removeAttribute(attr);
  }
  static hasTGAttribute(node, attr) {
    const tgAttr = this.tgAttribute(attr);
    return node.hasAttribute(tgAttr) || node.hasAttribute(attr);
  }
  static querySelectorAllTGAttribute(node, attr, value = void 0) {
    const tgAttr = this.tgAttribute(attr);
    if (value) {
      return node.querySelectorAll(`[${tgAttr}=${value}], [${attr}=${value}]`);
    }
    return node.querySelectorAll(`[${tgAttr}], [${attr}]`);
  }
};

// src/turbograft/csrf_token.ts
var CSRFToken = class {
  /**
   * Gets the CSRF token from a meta tag in the document
   * @param doc The document to search in (defaults to current document)
   * @returns Object containing the meta node and token if found
   */
  static get(doc = document) {
    const tag = doc.querySelector('meta[name="csrf-token"]');
    const result = {
      node: tag
    };
    if (tag) {
      result.token = tag.getAttribute("content") || void 0;
    }
    return result;
  }
  /**
   * Updates the CSRF token meta tag with a new value if different from current
   * @param latest The new token value to set
   */
  static update(latest) {
    const current = this.get();
    if (current.token != null && latest != null && current.token !== latest && current.node != null) {
      current.node.setAttribute("content", latest);
    }
  }
};

// src/turbograft/refresh.ts
var PageRefresh = class {
  constructor(turboLinks) {
    this.onReplaceCallbacks = [];
    this.isInitialized = false;
    this.turboLinks = turboLinks;
    this.handleBeforePartialReplace = this.handleBeforePartialReplace.bind(this);
    this.handleBeforeReplace = this.handleBeforeReplace.bind(this);
  }
  visit(url, opts = {}) {
    if (opts.reload) {
      window.location.href = url;
    } else {
      this.turboLinks.visit(url);
    }
  }
  refresh(options = {}, callback) {
    const newUrl = this.constructUrl(options);
    const turboOptions = {
      partialReplace: true,
      exceptKeys: options.exceptKeys,
      onlyKeys: options.onlyKeys,
      updatePushState: options.updatePushState,
      callback
    };
    if (options.response) {
      this.turboLinks.loadPage(null, options.response, turboOptions);
    } else {
      this.turboLinks.visit(newUrl, turboOptions);
    }
  }
  openWindow(...args) {
    return window.open(...args);
  }
  onReplace(node, callback) {
    if (!node || !callback) {
      throw new Error(
        "PageRefresh.onReplace: Node and callback must both be specified"
      );
    }
    this.onReplaceCallbacks.push({ node, callback });
  }
  initialize() {
    if (this.isInitialized) {
      return;
    }
    document.addEventListener(
      "page:before-partial-replace",
      this.handleBeforePartialReplace
    );
    document.addEventListener(
      "page:before-replace",
      this.handleBeforeReplace
    );
    this.isInitialized = true;
  }
  destroy() {
    document.removeEventListener(
      "page:before-partial-replace",
      this.handleBeforePartialReplace
    );
    document.removeEventListener(
      "page:before-replace",
      this.handleBeforeReplace
    );
    this.onReplaceCallbacks = [];
    this.isInitialized = false;
  }
  constructUrl(options) {
    if (options.url) {
      return options.url;
    }
    if (options.queryParams) {
      const paramString = new URLSearchParams(options.queryParams).toString();
      return paramString ? `${location.pathname}?${paramString}` : location.pathname;
    }
    return location.href;
  }
  handleBeforePartialReplace(event) {
    const replacedNodes = event.data;
    const unprocessedCallbacks = this.onReplaceCallbacks.filter((entry) => {
      const nodeWasReplaced = replacedNodes.some(
        (replacedNode) => replacedNode.contains(entry.node)
      );
      if (nodeWasReplaced) {
        entry.callback();
        return false;
      }
      return true;
    });
    this.onReplaceCallbacks = unprocessedCallbacks;
  }
  handleBeforeReplace() {
    this.onReplaceCallbacks.forEach((entry) => entry.callback());
    this.onReplaceCallbacks = [];
  }
};

// src/turbograft/remote.ts
var Remote = class {
  constructor(opts, eventManager, turboLinks, form, target) {
    this.onSuccess = (ev) => {
      var _a, _b;
      (_b = (_a = this.opts).success) == null ? void 0 : _b.call(_a);
      const xhr = ev.target;
      this.eventManager.triggerFor("turbograft:remote:success" /* RemoteSuccess */, this.initiator, {
        initiator: this.initiator,
        xhr
      });
      const redirect = xhr.getResponseHeader("X-Next-Redirect");
      if (redirect) {
        this.pageRefresh.visit(redirect, { reload: true });
        return;
      }
      if (!TurboGraftAttributes.hasTGAttribute(
        this.initiator,
        "tg-remote-norefresh"
      )) {
        if (this.opts.fullRefresh && this.refreshOnSuccess) {
          this.pageRefresh.refresh({ onlyKeys: this.refreshOnSuccess });
        } else if (this.opts.fullRefresh) {
          this.pageRefresh.refresh();
        } else if (this.refreshOnSuccess) {
          this.pageRefresh.refresh({
            response: xhr,
            onlyKeys: this.refreshOnSuccess
          });
        } else if (this.refreshOnSuccessExcept) {
          this.pageRefresh.refresh({
            response: xhr,
            exceptKeys: this.refreshOnSuccessExcept
          });
        } else {
          this.pageRefresh.refresh({ response: xhr });
        }
      }
    };
    this.onError = (ev) => {
      var _a, _b;
      (_b = (_a = this.opts).fail) == null ? void 0 : _b.call(_a);
      const xhr = ev.target;
      this.eventManager.triggerFor("turbograft:remote:fail" /* RemoteFail */, this.initiator, {
        initiator: this.initiator,
        xhr
      });
      if (TurboGraftAttributes.hasTGAttribute(this.initiator, "tg-remote-norefresh")) {
        this.eventManager.triggerFor(
          "turbograft:remote:fail:unhandled" /* RemoteFailUnhandled */,
          this.initiator,
          {
            xhr
          }
        );
        return;
      }
      if (this.opts.fullRefresh && this.refreshOnError) {
        this.pageRefresh.refresh({ onlyKeys: this.refreshOnError });
      } else if (this.opts.fullRefresh) {
        this.pageRefresh.refresh();
      } else if (this.refreshOnError) {
        this.pageRefresh.refresh({
          response: xhr,
          onlyKeys: this.refreshOnError
        });
      } else if (this.refreshOnErrorExcept) {
        this.pageRefresh.refresh({
          response: xhr,
          exceptKeys: this.refreshOnErrorExcept
        });
      } else {
        this.eventManager.triggerFor(
          "turbograft:remote:fail:unhandled" /* RemoteFailUnhandled */,
          this.initiator,
          {
            xhr
          }
        );
      }
    };
    var _a, _b, _c, _d, _e;
    this.opts = opts;
    this.eventManager = eventManager;
    const initator = form || target;
    if (!initator) {
      throw new Error("One of form or target must be specified.");
    }
    this.initiator = initator;
    this.pageRefresh = new PageRefresh(turboLinks);
    this.actualRequestType = ((_a = opts.httpRequestType) == null ? void 0 : _a.toLowerCase()) === "get" ? "GET" : "POST";
    this.useNativeEncoding = opts.useNativeEncoding;
    this.formData = this.createPayload(form);
    this.refreshOnSuccess = (_b = opts.refreshOnSuccess) == null ? void 0 : _b.split(" ");
    this.refreshOnSuccessExcept = (_c = opts.refreshOnSuccessExcept) == null ? void 0 : _c.split(" ");
    this.refreshOnError = (_d = opts.refreshOnError) == null ? void 0 : _d.split(" ");
    this.refreshOnErrorExcept = (_e = opts.refreshOnErrorExcept) == null ? void 0 : _e.split(" ");
    const xhr = new XMLHttpRequest();
    if (this.actualRequestType === "GET") {
      const url = this.formData ? `${opts.httpUrl}?${this.formData}` : opts.httpUrl;
      xhr.open(this.actualRequestType, url, true);
    } else {
      xhr.open(this.actualRequestType, opts.httpUrl, true);
    }
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader(
      "Accept",
      "text/html, application/xhtml+xml, application/xml"
    );
    if (this.contentType) {
      xhr.setRequestHeader("Content-Type", this.contentType);
    }
    xhr.setRequestHeader("X-XHR-Referer", document.location.href);
    const csrfToken = CSRFToken.get().token;
    if (csrfToken) {
      xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    }
    this.eventManager.triggerFor("turbograft:remote:init" /* RemoteInit */, this.initiator, {
      xhr,
      initiator: this.initiator
    });
    xhr.addEventListener("loadstart", () => {
      this.eventManager.triggerFor("turbograft:remote:start" /* RemoteStart */, this.initiator, {
        xhr
      });
    });
    xhr.addEventListener("error", this.onError);
    xhr.addEventListener("load", (event) => {
      if (xhr.status < 400) {
        this.onSuccess(event);
      } else {
        this.onError(event);
      }
    });
    xhr.addEventListener("loadend", () => {
      var _a2, _b2;
      (_b2 = (_a2 = this.opts).done) == null ? void 0 : _b2.call(_a2);
      this.eventManager.triggerFor("turbograft:remote:always" /* RemoteAlways */, this.initiator, {
        initiator: this.initiator,
        xhr
      });
    });
    this.xhr = xhr;
  }
  submit() {
    this.xhr.send(this.formData);
  }
  createPayload(form) {
    if (!form)
      return "";
    let formData = "";
    if (this.useNativeEncoding || form.querySelectorAll("[type='file'][name]").length > 0) {
      formData = this.nativeEncodeForm(form);
    } else {
      formData = this.uriEncodeForm(form);
    }
    if (!(formData instanceof FormData)) {
      this.contentType = "application/x-www-form-urlencoded; charset=UTF-8";
      if (!formData.includes("_method") && this.opts.httpRequestType && this.actualRequestType !== "GET") {
        return this.formAppend(formData, "_method", this.opts.httpRequestType);
      }
    }
    return formData;
  }
  formAppend(uriEncoded, key, value) {
    const prefix = uriEncoded.length ? "&" : "";
    return `${uriEncoded}${prefix}${encodeURIComponent(
      key
    )}=${encodeURIComponent(value)}`;
  }
  uriEncodeForm(form) {
    let formData = "";
    this.iterateOverFormInputs(form, (input) => {
      formData = this.formAppend(formData, input.name, input.value);
    });
    return formData;
  }
  formDataAppend(formData, input) {
    var _a;
    if (input.type === "file") {
      Array.from((_a = input.files) != null ? _a : []).forEach((file) => {
        formData.append(input.name, file);
      });
    } else {
      formData.append(input.name, input.value);
    }
    return formData;
  }
  nativeEncodeForm(form) {
    const formData = new FormData();
    this.iterateOverFormInputs(form, (input) => {
      this.formDataAppend(formData, input);
    });
    return formData;
  }
  iterateOverFormInputs(form, callback) {
    const inputs = this.enabledInputs(form);
    inputs.forEach((input) => {
      const inputEnabled = !input.disabled;
      const radioOrCheck = input.type === "checkbox" || input.type === "radio";
      if (inputEnabled && input.name) {
        if (radioOrCheck && input.checked || !radioOrCheck) {
          callback(input);
        }
      }
    });
  }
  enabledInputs(form) {
    const selector = "input:not([type='reset']):not([type='button']):not([type='submit']):not([type='image']), select, textarea";
    const inputs = Array.from(
      form.querySelectorAll(selector)
    );
    const disabledNodes = Array.from(
      TurboGraftAttributes.querySelectorAllTGAttribute(
        form,
        "tg-remote-noserialize"
      )
    );
    if (!disabledNodes.length)
      return inputs;
    const disabledInputs = disabledNodes.flatMap(
      (node) => Array.from(node.querySelectorAll(selector))
    );
    return inputs.filter((input) => !disabledInputs.includes(input));
  }
};

// src/turbograft/turbograft.ts
var TurboGraft = class {
  constructor(eventManager, turboLinks) {
    this.eventManager = eventManager;
    this.turboLinks = turboLinks;
  }
  /**
   * Initialize all event handlers
   */
  initialize() {
    this.documentListenerForButtons(
      "click",
      this.remoteMethodHandler.bind(this),
      true
    );
    document.addEventListener(
      "submit",
      (ev) => this.remoteFormHandler(ev)
    );
  }
  /**
   * Checks if an element has a specific class
   */
  hasClass(node, search) {
    return node.classList.contains(search);
  }
  /**
   * Checks if a node is disabled
   */
  nodeIsDisabled(node) {
    return node.hasAttribute("disabled") || this.hasClass(node, "disabled");
  }
  /**
   * Sets up a remote request from a target element
   */
  setupRemoteFromTarget(target, httpRequestType, form = void 0) {
    const httpUrl = target.getAttribute("href") || target.getAttribute("action");
    if (!httpUrl) {
      throw new Error(
        `Turbograft developer error: You did not provide a URL for data-tg-remote`
      );
    }
    if (TurboGraftAttributes.getTGAttribute(target, "remote-once")) {
      TurboGraftAttributes.removeTGAttribute(target, "remote-once");
      TurboGraftAttributes.removeTGAttribute(target, "tg-remote");
    }
    const options = {
      httpRequestType,
      httpUrl,
      fullRefresh: TurboGraftAttributes.getTGAttribute(target, "full-refresh") !== null,
      refreshOnSuccess: TurboGraftAttributes.getTGAttribute(
        target,
        "refresh-on-success"
      ),
      refreshOnSuccessExcept: TurboGraftAttributes.getTGAttribute(
        target,
        "full-refresh-on-success-except"
      ),
      refreshOnError: TurboGraftAttributes.getTGAttribute(
        target,
        "refresh-on-error"
      ),
      refreshOnErrorExcept: TurboGraftAttributes.getTGAttribute(
        target,
        "full-refresh-on-error-except"
      )
    };
    return new Remote(
      options,
      this.eventManager,
      this.turboLinks,
      form,
      target
    );
  }
  /**
   * Handles remote method events
   */
  remoteMethodHandler(ev) {
    const target = ev.clickTarget;
    const httpRequestType = TurboGraftAttributes.getTGAttribute(
      target,
      "tg-remote"
    );
    if (!httpRequestType) {
      return;
    }
    ev.preventDefault();
    const remote = this.setupRemoteFromTarget(target, httpRequestType);
    remote.submit();
  }
  /**
   * Handles remote form submissions
   */
  remoteFormHandler(ev) {
    const target = ev.target;
    const method = target.getAttribute("method");
    if (!TurboGraftAttributes.hasTGAttribute(target, "tg-remote")) {
      return;
    }
    ev.preventDefault();
    const remote = this.setupRemoteFromTarget(target, method || "GET", target);
    remote.submit();
  }
  /**
   * Sets up document-wide event listener for buttons and links
   */
  documentListenerForButtons(eventType, handler, useCapture = false) {
    document.addEventListener(
      eventType,
      (ev) => {
        let target = ev.target;
        while (target && target !== document.documentElement) {
          if (target.nodeName === "A" || target.nodeName === "BUTTON") {
            const isNodeDisabled = this.nodeIsDisabled(target);
            if (isNodeDisabled) {
              ev.preventDefault();
            }
            if (!isNodeDisabled) {
              const extendedEvent = ev;
              extendedEvent.clickTarget = target;
              handler(extendedEvent);
              return;
            }
          }
          target = target.parentNode;
        }
      },
      useCapture
    );
  }
};

// src/link.ts
var _Link = class extends URL {
  /**
   * Creates a new Link instance
   * @param link The anchor element to process
   */
  constructor(link) {
    super(link.href);
    this.link = link;
  }
  /**
   * Add additional HTML extensions to be processed
   * @param extensions List of extensions to add
   * @returns Updated array of HTML extensions
   */
  static allowExtensions(...extensions) {
    _Link.HTML_EXTENSIONS.push(...extensions);
    return _Link.HTML_EXTENSIONS;
  }
  /**
   * Determines if the link should be ignored by Turbolinks
   */
  shouldIgnore() {
    return this._crossOrigin() || this._anchored() || this._nonHtml() || this._optOut() || this._target();
  }
  /**
   * Returns the URL without the hash fragment
   */
  withoutHash() {
    return this.href.replace(this.hash, "");
  }
  /**
   * Checks if the link points to a different origin
   */
  _crossOrigin() {
    return this.origin !== new URL(document.location.href).origin;
  }
  /**
   * Checks if the link is just an anchor to the current page
   */
  _anchored() {
    const currentUrl = new URL(document.location.href);
    return this.hash && this.withoutHash() === currentUrl.href.replace(currentUrl.hash, "") || this.href === currentUrl.href + "#";
  }
  /**
   * Checks if the link points to a non-HTML resource
   */
  _nonHtml() {
    var _a;
    const extension = (_a = this.pathname.match(/\.[a-z]+$/i)) == null ? void 0 : _a[0];
    if (!extension)
      return false;
    const htmlExtensionPattern = new RegExp(
      `\\.(${_Link.HTML_EXTENSIONS.join("|")})?$`,
      "i"
    );
    return Boolean(extension && !this.pathname.match(htmlExtensionPattern));
  }
  /**
   * Checks if the link or any of its parents opt out of Turbolinks
   */
  _optOut() {
    let currentElement = this.link;
    while (currentElement && currentElement !== document.documentElement) {
      if (currentElement.hasAttribute("data-no-turbolink")) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }
    return false;
  }
  /**
   * Checks if the link has a target attribute
   */
  _target() {
    return this.link.target.length > 0;
  }
};
var Link = _Link;
/*
 * Represents a link element in the DOM as if it's a standard
 * in-memory URL object. Provides additional utility functions
 * to determine Turbo behavior of that link.
 */
Link.HTML_EXTENSIONS = ["html"];

// src/click.ts
var ClickHandler = class {
  constructor(linkClickCallback) {
    this.linkClickCallback = linkClickCallback;
  }
  installHandler(document2) {
    document2.addEventListener("click", this.handle.bind(this), false);
  }
  handle(event) {
    if (event.defaultPrevented) {
      return;
    }
    console.log("Should handle", event);
    const linkClickEvent = new LinkClickEvent(event);
    if (!linkClickEvent.validForTurbolinks())
      return;
    this.linkClickCallback(linkClickEvent);
    event.preventDefault();
  }
};
var LinkClickEvent = class {
  constructor(event) {
    this.event = event;
    if (this.event.defaultPrevented) {
      return;
    }
    this._extractLink();
  }
  _extractLink() {
    let link = this.event.target;
    while (link.parentNode && link.nodeName !== "A") {
      link = link.parentNode;
    }
    if (link.nodeName === "A" && link.href.length !== 0) {
      this.link = new Link(link);
    }
  }
  validForTurbolinks() {
    return this.link != null && !this.link.shouldIgnore() && !this._nonStandardClick();
  }
  _nonStandardClick() {
    return this.event.which > 1 || this.event.metaKey || this.event.ctrlKey || this.event.shiftKey || this.event.altKey;
  }
};

// src/page.ts
var PageUpdater = class {
  constructor(document2) {
    this.currentUrl = null;
    this.document = document2;
    this.bodyElement = document2.body;
  }
  updatePage(newDocument, url, options) {
    var _a, _b, _c, _d;
    this.currentUrl = url;
    const newBody = newDocument.querySelector("body");
    const newTitle = (_a = newDocument.querySelector("title")) == null ? void 0 : _a.textContent;
    if (!newBody) {
      throw new Error("New document must contain a body element");
    }
    if (newTitle) {
      this.document.title = newTitle;
    }
    if ((_b = options.onlyKeys) == null ? void 0 : _b.length) {
      this.updateSelectedNodes(newBody, options.onlyKeys);
    } else if ((_c = options.exceptKeys) == null ? void 0 : _c.length) {
      this.updateAllExceptNodes(newBody, options.exceptKeys);
    } else {
      this.replaceBody(newBody);
    }
    if (options.updatePushState) {
      this.updateUrl();
    }
    (_d = options.callback) == null ? void 0 : _d.call(options);
    this.dispatchEvent("page:load");
  }
  updateSelectedNodes(newBody, keys) {
    const nodesToUpdate = this.getNodesMatchingKeys(keys);
    nodesToUpdate.forEach((existingNode) => {
      const id = existingNode.id;
      if (!id) {
        throw new Error("All nodes to be updated must have an ID");
      }
      const newNode = newBody.querySelector(`#${id}`);
      if (newNode) {
        this.replaceNode(existingNode, newNode.cloneNode(true));
      } else {
        if (!existingNode.hasAttribute("data-turbo-permanent")) {
          existingNode.remove();
        }
      }
    });
  }
  updateAllExceptNodes(newBody, exceptKeys) {
    const nodesToKeep = this.getNodesMatchingKeys(exceptKeys);
    const preservedNodes = /* @__PURE__ */ new Map();
    nodesToKeep.forEach((node) => {
      const id = node.id;
      if (!id) {
        throw new Error("All preserved nodes must have an ID");
      }
      preservedNodes.set(id, node.cloneNode(true));
    });
    this.replaceBody(newBody);
    preservedNodes.forEach((node, id) => {
      const target = this.document.getElementById(id);
      if (target) {
        this.replaceNode(target, node);
      }
    });
  }
  replaceBody(newBody) {
    const permanentElements = this.document.querySelectorAll(
      "[data-turbo-permanent]"
    );
    const preservedElements = /* @__PURE__ */ new Map();
    permanentElements.forEach((element) => {
      const id = element.id;
      if (!id) {
        throw new Error("Permanent elements must have an ID");
      }
      preservedElements.set(id, element.cloneNode(true));
    });
    this.bodyElement.innerHTML = newBody.innerHTML;
    preservedElements.forEach((element, id) => {
      const target = this.document.getElementById(id);
      if (target) {
        this.replaceNode(target, element);
      }
    });
    this.executeScripts();
  }
  replaceNode(oldNode, newNode) {
    var _a;
    (_a = oldNode.parentNode) == null ? void 0 : _a.replaceChild(newNode, oldNode);
    this.dispatchEvent("page:after-node-replaced", { oldNode, newNode });
  }
  getNodesMatchingKeys(keys) {
    return keys.flatMap(
      (key) => Array.from(
        this.document.querySelectorAll(`[data-turbo-refresh="${key}"]`)
      )
    );
  }
  updateUrl() {
    if (!this.currentUrl) {
      throw new Error("Cannot update URL without a current URL");
    }
    const newUrl = this.currentUrl.toString();
    if (newUrl !== window.location.href) {
      window.history.pushState({ turbolinks: true, url: newUrl }, "", newUrl);
      this.dispatchEvent("page:url-changed", { url: newUrl });
    }
  }
  executeScripts() {
    const scripts = Array.from(
      this.document.querySelectorAll(
        'script:not([data-turbo-eval="false"])'
      )
    );
    scripts.forEach((oldScript) => {
      var _a;
      if (!oldScript.type || oldScript.type === "text/javascript") {
        const newScript = this.document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        (_a = oldScript.parentNode) == null ? void 0 : _a.replaceChild(newScript, oldScript);
      }
    });
  }
  dispatchEvent(name, detail) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail
    });
    return this.document.dispatchEvent(event);
  }
};

// src/turbohead.ts
var TRACKED_ASSET_SELECTOR = "[data-turbolinks-track]";
var TRACKED_ATTRIBUTE_NAME = "turbolinksTrack";
var ANONYMOUS_TRACK_VALUE = "true";
var _TurboHead = class {
  constructor(activeDocument, upstreamDocument, eventManager) {
    this.activeDocument = activeDocument;
    this.upstreamDocument = upstreamDocument;
    this.eventManager = eventManager;
    this.activeAssets = this.extractTrackedAssets(this.activeDocument);
    this.upstreamAssets = this.extractTrackedAssets(this.upstreamDocument);
    this.newScripts = this.upstreamAssets.filter((asset) => this.attributeMatches("nodeName", "SCRIPT")(asset)).filter(
      (asset) => this.noAttributeMatchesIn("src", this.activeAssets)(asset)
    );
    this.newLinks = this.upstreamAssets.filter((asset) => this.attributeMatches("nodeName", "LINK")(asset)).filter(
      (asset) => this.noAttributeMatchesIn("href", this.activeAssets)(asset)
    );
  }
  extractTrackedAssets(doc) {
    return Array.from(
      doc.querySelectorAll(TRACKED_ASSET_SELECTOR)
    );
  }
  attributeMatches(attribute, value) {
    return (node) => node[attribute] === value;
  }
  attributeMatchesIn(attribute, collection) {
    return (node) => collection.some(
      (nodeFromCollection) => node[attribute] === nodeFromCollection[attribute]
    );
  }
  noAttributeMatchesIn(attribute, collection) {
    return (node) => !this.attributeMatchesIn(attribute, collection)(node);
  }
  datasetMatches(attribute, value) {
    return (node) => node.dataset[attribute] === value;
  }
  noDatasetMatches(attribute, value) {
    return (node) => node.dataset[attribute] !== value;
  }
  datasetMatchesIn(attribute, collection) {
    return (node) => {
      const value = node.dataset[attribute];
      if (!value)
        return false;
      return collection.some(
        (asset) => this.datasetMatches(attribute, value)(asset)
      );
    };
  }
  async insertScript(scriptNode) {
    const url = scriptNode.src;
    if (url && _TurboHead.scriptPromises[url]) {
      return _TurboHead.scriptPromises[url];
    }
    const newNode = this.activeDocument.createElement("script");
    Array.from(scriptNode.attributes).forEach((attr) => {
      newNode.setAttribute(attr.name, attr.value);
    });
    newNode.appendChild(
      this.activeDocument.createTextNode(scriptNode.innerHTML)
    );
    const promise = new Promise((resolve) => {
      const onAssetEvent = (event) => {
        if (event.type === "error") {
          this.eventManager.trigger("page:#script-error" /* PageScriptError */, event);
        }
        newNode.removeEventListener("load", onAssetEvent);
        newNode.removeEventListener("error", onAssetEvent);
        resolve();
      };
      newNode.addEventListener("load", onAssetEvent);
      newNode.addEventListener("error", onAssetEvent);
      this.activeDocument.head.appendChild(newNode);
      this.eventManager.trigger("page:after-script-inserted" /* PageAfterScriptInserted */, newNode);
    });
    if (url) {
      _TurboHead.scriptPromises[url] = promise;
    }
    return promise;
  }
  updateLinkTags() {
    this.newLinks.forEach((linkNode) => {
      const newNode = linkNode.cloneNode(true);
      this.activeDocument.head.appendChild(newNode);
      this.eventManager.trigger("page:after-link-inserted" /* PageAfterLinkInserted */, newNode);
    });
  }
  async updateScriptTags() {
    for (const scriptNode of this.newScripts) {
      await this.insertScript(scriptNode);
    }
  }
  async waitForCompleteDownloads() {
    return Promise.all(Object.values(_TurboHead.scriptPromises));
  }
  hasChangedAnonymousAssets() {
    const anonymousUpstreamAssets = this.upstreamAssets.filter(
      this.datasetMatches(TRACKED_ATTRIBUTE_NAME, ANONYMOUS_TRACK_VALUE)
    );
    const anonymousActiveAssets = this.activeAssets.filter(
      this.datasetMatches(TRACKED_ATTRIBUTE_NAME, ANONYMOUS_TRACK_VALUE)
    );
    if (anonymousActiveAssets.length !== anonymousUpstreamAssets.length) {
      return true;
    }
    const noMatchingSrc = this.noAttributeMatchesIn(
      "src",
      anonymousUpstreamAssets
    );
    const noMatchingHref = this.noAttributeMatchesIn(
      "href",
      anonymousUpstreamAssets
    );
    return anonymousActiveAssets.some(
      (node) => noMatchingSrc(node) || noMatchingHref(node)
    );
  }
  movingFromTrackedToUntracked() {
    return this.upstreamAssets.length === 0 && this.activeAssets.length > 0;
  }
  hasNamedAssetConflicts() {
    return [...this.newScripts, ...this.newLinks].filter(
      this.noDatasetMatches(TRACKED_ATTRIBUTE_NAME, ANONYMOUS_TRACK_VALUE)
    ).some(this.datasetMatchesIn(TRACKED_ATTRIBUTE_NAME, this.activeAssets));
  }
  hasAssetConflicts() {
    return this.movingFromTrackedToUntracked() || this.hasNamedAssetConflicts() || this.hasChangedAnonymousAssets();
  }
  async waitForAssets() {
    if (_TurboHead.resolvePreviousRequest) {
      _TurboHead.resolvePreviousRequest({ isCanceled: true });
    }
    return new Promise((resolve) => {
      _TurboHead.resolvePreviousRequest = resolve;
      return this.waitForCompleteDownloads().then(() => {
        this.updateLinkTags();
        return this.updateScriptTags();
      }).then(() => this.waitForCompleteDownloads()).then(() => resolve({}));
    });
  }
};
var TurboHead = _TurboHead;
TurboHead.scriptPromises = {};
TurboHead.resolvePreviousRequest = null;
TurboHead._testAPI = {
  reset() {
    _TurboHead.scriptPromises = {};
    _TurboHead.resolvePreviousRequest = null;
  }
};

// src/turbolinks.ts
var TurboLinks = class {
  constructor(eventManager) {
    this.referer = null;
    this.currentController = null;
    this.isInitialized = false;
    this.eventManager = eventManager;
    this.activeDocument = document;
  }
  initialize() {
    if (this.browserSupportsTurbolinks()) {
      this.installFeatures();
    } else {
      console.warn(
        "Browser does not support Turbolinks, falling back to default <a> behavior"
      );
    }
  }
  setDocument(document2) {
    this.activeDocument = document2;
  }
  getDocument() {
    return this.activeDocument;
  }
  browserSupportsTurbolinks() {
    const historyStateIsDefined = window.history.state !== void 0 || navigator.userAgent.match(/Firefox\/2[6|7]/) !== null;
    return !!(window.history && historyStateIsDefined && this.requestMethodIsSafe());
  }
  installFeatures() {
    if (this.isInitialized) {
      return;
    }
    this.installDocumentReadyPageEventTriggers();
    this.installAjaxSuccessPageUpdateTrigger();
    this.installClickHandler();
    this.installHistoryHandler();
    this.isInitialized = true;
  }
  installDocumentReadyPageEventTriggers() {
    this.activeDocument.addEventListener(
      "DOMContentLoaded",
      () => {
        this.eventManager.trigger("page:change" /* PageChange */);
        this.eventManager.trigger("page:update" /* PageUpdate */);
      },
      true
    );
  }
  installAjaxSuccessPageUpdateTrigger() {
    this.activeDocument.addEventListener("turbolinks:ajax-success", () => {
      this.eventManager.trigger("page:update" /* PageUpdate */);
    });
  }
  installClickHandler() {
    const callback = (click) => {
      if (click.link) {
        this.visit(click.link.href);
      }
    };
    const clickHandler = new ClickHandler(callback.bind(this));
    clickHandler.installHandler(this.activeDocument);
  }
  installHistoryHandler() {
    setTimeout(() => {
      window.addEventListener(
        "popstate",
        this.handlePopState.bind(this),
        false
      );
    }, 500);
  }
  visit(url, options = {}) {
    if (this.browserSupportsTurbolinks()) {
      this.initiateVisit(url, options);
    } else {
      window.location.href = url;
    }
  }
  initiateVisit(url, options) {
    if (this.pageChangePrevented(url)) {
      return;
    }
    this.rememberReferer();
    this.fetchPage(url, options);
  }
  fullPageNavigate(url) {
    if (url) {
      const absoluteUrl = new URL(url).href;
      this.eventManager.trigger("page:before-full-refresh" /* PageBeforeFullRefresh */, {
        url: absoluteUrl
      });
      window.location.href = absoluteUrl;
    }
  }
  async fetchPage(url, options) {
    if (this.currentController) {
      this.currentController.abort();
    }
    this.currentController = new AbortController();
    const componentUrl = new URL(url);
    try {
      await this.performFetch(componentUrl, options);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      this.fullPageNavigate(url);
    }
  }
  async performFetch(componentUrl, options) {
    this.eventManager.trigger("page:fetch" /* PageFetch */, { url: componentUrl.href });
    const headers = new Headers({
      Accept: "text/html, application/xhtml+xml, application/xml",
      "X-XHR-Referer": this.referer || "",
      ...options.headers
    });
    try {
      const response = await fetch(componentUrl, {
        method: "GET",
        headers,
        signal: this.currentController.signal,
        credentials: "same-origin"
      });
      if (!response.ok || response.status >= 500) {
        this.fullPageNavigate(componentUrl.href);
        return;
      }
      const text = await response.text();
      this.processResponse(componentUrl, response, text, options);
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      this.fullPageNavigate(componentUrl.href);
    }
  }
  processResponse(componentUrl, response, html, options) {
    var _a;
    this.eventManager.trigger("page:receive" /* PageReceive */);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    if (!doc) {
      this.eventManager.trigger("page:error" /* PageError */, response);
      this.fullPageNavigate(componentUrl.href);
      return;
    }
    options.updatePushState = (_a = options.updatePushState) != null ? _a : true;
    options.partialReplace = this.isPartialReplace(options);
    const pageUpdater = new PageUpdater(this.activeDocument);
    if (options.partialReplace) {
      pageUpdater.updatePage(doc, componentUrl, options);
      return;
    }
    const turbohead = new TurboHead(
      this.activeDocument,
      doc,
      this.eventManager
    );
    if (turbohead.hasAssetConflicts()) {
      this.fullPageNavigate(componentUrl.href);
      return;
    }
    turbohead.waitForAssets().then((result) => {
      if (!(result == null ? void 0 : result.isCanceled)) {
        pageUpdater.updatePage(doc, componentUrl, options);
      }
    });
  }
  isPartialReplace(options) {
    var _a, _b;
    return Boolean(
      options.partialReplace || ((_a = options.onlyKeys) == null ? void 0 : _a.length) || ((_b = options.exceptKeys) == null ? void 0 : _b.length)
    );
  }
  rememberReferer() {
    this.referer = this.activeDocument.location.href;
  }
  pageChangePrevented(url) {
    return !this.eventManager.trigger("page:before-change" /* PageBeforeChange */, url);
  }
  handlePopState(event) {
    var _a, _b, _c;
    if ((_a = event.state) == null ? void 0 : _a.turbolinks) {
      this.visit(((_c = (_b = event.target) == null ? void 0 : _b.location) == null ? void 0 : _c.href) || window.location.href);
    }
  }
  requestMethodIsSafe() {
    const requestMethod = this.popCookie("request_method");
    return requestMethod === "GET" || requestMethod === "";
  }
  popCookie(name) {
    var _a;
    const match = this.activeDocument.cookie.match(
      new RegExp(name + "=(\\w+)")
    );
    const value = ((_a = match == null ? void 0 : match[1]) == null ? void 0 : _a.toUpperCase()) || "";
    this.activeDocument.cookie = `${name}=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/`;
    return value;
  }
  destroy() {
    if (this.currentController) {
      this.currentController.abort();
    }
    this.activeDocument.removeEventListener(
      "DOMContentLoaded",
      this.installDocumentReadyPageEventTriggers
    );
    this.activeDocument.removeEventListener(
      "turbolinks:ajax-success",
      this.installAjaxSuccessPageUpdateTrigger
    );
    window.removeEventListener("popstate", this.handlePopState);
    this.isInitialized = false;
  }
};

// src/index.ts
var TurboHref = class {
  constructor(document2 = window.document) {
    this.activeDocument = null;
    this.eventManager = new EventManager();
    this.turboLinks = new TurboLinks(this.eventManager);
    this.turboGraft = new TurboGraft(this.eventManager, this.turboLinks);
    this.setActiveDocument(document2);
  }
  activate() {
    this.turboLinks.initialize();
    this.turboGraft.initialize();
    console.info("TurboHref activated");
  }
  setActiveDocument(document2) {
    this.activeDocument = document2;
    this.eventManager.setDocument(this.activeDocument);
    this.turboLinks.setDocument(this.activeDocument);
  }
};
export {
  TurboHref
};
