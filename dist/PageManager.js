export class PageManager {
    async update(newDocument, options = {}) {
        this.triggerEvent('turbohref:before-render');
        if (options.partialReplace) {
            await this.performPartialUpdate(newDocument, options);
        }
        else {
            await this.performFullUpdate(newDocument);
        }
        this.triggerEvent('turbohref:render');
        this.executeScripts();
        this.updateScrollPosition();
    }
    async performPartialUpdate(newDocument, options) {
        const { onlyKeys = [], exceptKeys = [] } = options;
        if (onlyKeys.length > 0) {
            await this.updateMatchingElements(newDocument, onlyKeys);
        }
        else if (exceptKeys.length > 0) {
            await this.updateExceptElements(newDocument, exceptKeys);
        }
    }
    async performFullUpdate(newDocument) {
        // Preserve elements marked as permanent
        const permanentElements = document.querySelectorAll(PageManager.PERMANENT_SELECTOR);
        permanentElements.forEach(element => {
            const id = element.id;
            if (!id)
                throw new Error('Permanent elements must have an id');
            const newElement = newDocument.getElementById(id);
            if (newElement) {
                newElement.replaceWith(element.cloneNode(true));
            }
        });
        // Update the entire body
        document.body.replaceWith(newDocument.body.cloneNode(true));
        // Update the title if it changed
        if (newDocument.title !== document.title) {
            document.title = newDocument.title;
        }
    }
    async updateMatchingElements(newDocument, keys) {
        for (const key of keys) {
            const selector = `[data-turbohref-refresh="${key}"]`;
            const elements = document.querySelectorAll(selector);
            const newElements = newDocument.querySelectorAll(selector);
            elements.forEach((element, index) => {
                const newElement = newElements[index];
                if (newElement) {
                    element.replaceWith(newElement.cloneNode(true));
                }
            });
        }
    }
    async updateExceptElements(newDocument, keys) {
        const selectors = keys.map(key => `[data-turbohref-refresh="${key}"]`);
        const elementsToKeep = document.querySelectorAll(selectors.join(','));
        // Store the elements we want to keep
        const preserved = new Map();
        elementsToKeep.forEach(element => {
            const id = element.id;
            if (!id)
                throw new Error('Elements to preserve must have an id');
            preserved.set(id, element.cloneNode(true));
        });
        // Replace the body
        document.body.replaceWith(newDocument.body.cloneNode(true));
        // Restore the preserved elements
        preserved.forEach((element, id) => {
            const newElement = document.getElementById(id);
            if (newElement) {
                newElement.replaceWith(element);
            }
        });
    }
    executeScripts() {
        const scripts = Array.from(document.getElementsByTagName('script'))
            .filter(script => !script.hasAttribute('data-turbohref-eval-false'));
        scripts.forEach(script => {
            var _a;
            const newScript = document.createElement('script');
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = script.textContent;
            (_a = script.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(newScript, script);
        });
    }
    updateScrollPosition() {
        if (window.location.hash) {
            const element = document.getElementById(window.location.hash.slice(1));
            if (element) {
                element.scrollIntoView();
            }
        }
        else {
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
}
PageManager.PERMANENT_SELECTOR = '[data-turbohref-permanent]';
//# sourceMappingURL=PageManager.js.map