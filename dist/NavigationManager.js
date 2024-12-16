export class NavigationManager {
    constructor(pageManager) {
        this.currentRequest = null;
        this.pageManager = pageManager;
        this.isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    }
    start() {
        window.addEventListener('popstate', this.handlePopState.bind(this));
        window.addEventListener('turbohref:click', ((event) => {
            this.visit(event.detail.url);
        }));
    }
    stop() {
        window.removeEventListener('popstate', this.handlePopState.bind(this));
    }
    async visit(url, options = {}) {
        if (!this.triggerEvent('turbohref:before-visit', { url })) {
            return;
        }
        // Cancel any in-flight requests
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
            const doc = parser.parseFromString(html, 'text/html');
            await this.pageManager.update(doc, options);
            if (!options.partialReplace) {
                window.history.pushState({ turbohref: true }, '', url);
            }
            this.triggerEvent('turbohref:visit', { url });
            if (options.callback) {
                options.callback();
            }
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            this.triggerEvent('turbohref:error', { error });
            // In test environment, just trigger an event instead of actual navigation
            if (this.isTestEnvironment) {
                this.triggerEvent('turbohref:fallback-navigation', { url });
            }
            else {
                window.location.href = url;
            }
        }
        finally {
            this.currentRequest = null;
        }
    }
    async fetchPage(url, signal) {
        return fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/html, application/xhtml+xml',
                'X-Requested-With': 'TurboHref'
            },
            credentials: 'same-origin',
            signal
        });
    }
    handlePopState(event) {
        var _a;
        if ((_a = event.state) === null || _a === void 0 ? void 0 : _a.turbohref) {
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
}
//# sourceMappingURL=NavigationManager.js.map