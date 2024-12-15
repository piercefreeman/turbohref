import { PageManager } from './PageManager';

export interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
}

export class NavigationManager {
    private currentRequest: AbortController | null = null;
    private pageManager: PageManager;
    private isTestEnvironment: boolean;

    constructor(pageManager: PageManager) {
        this.pageManager = pageManager;
        this.isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    }

    public start(): void {
        window.addEventListener('popstate', this.handlePopState.bind(this));
        window.addEventListener('turbohref:click', ((event: CustomEvent) => {
            this.visit(event.detail.url);
        }) as EventListener);
    }

    public stop(): void {
        window.removeEventListener('popstate', this.handlePopState.bind(this));
    }

    public async visit(url: string, options: VisitOptions = {}): Promise<void> {
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
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            this.triggerEvent('turbohref:error', { error });
            
            // In test environment, just trigger an event instead of actual navigation
            if (this.isTestEnvironment) {
                this.triggerEvent('turbohref:fallback-navigation', { url });
            } else {
                window.location.href = url;
            }
        } finally {
            this.currentRequest = null;
        }
    }

    private async fetchPage(url: string, signal: AbortSignal): Promise<Response> {
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

    private handlePopState(event: PopStateEvent): void {
        if (event.state?.turbohref) {
            this.visit(window.location.href);
        }
    }

    private triggerEvent(name: string, detail: any = {}): boolean {
        const event = new CustomEvent(name, {
            bubbles: true,
            cancelable: true,
            detail
        });
        return document.dispatchEvent(event);
    }
} 