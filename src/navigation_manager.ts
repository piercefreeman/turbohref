import { PageManager } from './page_manager';

export interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
}

interface NavigationManagerOptions {
    color?: string;
    height?: number;
}

export class NavigationManager {
    private currentRequest: AbortController | null = null;
    private pageManager: PageManager;
    private isTestEnvironment: boolean;
    private progressBar: HTMLDivElement;
    private color: string;
    private height: number;

    constructor(pageManager: PageManager, options: NavigationManagerOptions = {}) {
        this.pageManager = pageManager;
        this.isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
        this.color = options.color || 'rgb(0, 118, 255)';
        this.height = options.height || 3;
        this.progressBar = this.createProgressBar();
    }

    private createProgressBar(): HTMLDivElement {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '0%',
            height: `${this.height}px`,
            backgroundColor: this.color,
            transition: 'width 0.2s ease',
            zIndex: '9999',
        });
        return bar;
    }

    public start(): void {
        // Mount the progress bar if not already mounted
        if (!document.body.contains(this.progressBar)) {
            document.body.appendChild(this.progressBar);
        }

        // Start navigation event listeners
        window.addEventListener('popstate', this.handlePopState.bind(this));
        window.addEventListener('turbohref:click', ((event: CustomEvent) => {
            this.visit(event.detail.url);
        }) as EventListener);

        // Listen for turbohref events to show/hide progress
        document.addEventListener('turbohref:before-render', () => {
            this.showProgress();
        });

        document.addEventListener('turbohref:render', () => {
            this.completeProgress();
        });
    }

    public stop(): void {
        window.removeEventListener('popstate', this.handlePopState.bind(this));
        this.progressBar.remove();
    }

    private showProgress(): void {
        // Reset to 0 and then quickly animate to 80%
        this.progressBar.style.width = '0%';
        // Force a reflow to ensure the animation works
        this.progressBar.offsetHeight;
        this.progressBar.style.width = '80%';
    }

    private completeProgress(): void {
        // Quickly animate to 100% and then fade out
        this.progressBar.style.width = '100%';
        
        setTimeout(() => {
            // Add opacity transition
            this.progressBar.style.transition = 'width 0.2s ease, opacity 0.2s ease';
            this.progressBar.style.opacity = '0';
            
            // Reset after animation
            setTimeout(() => {
                this.progressBar.style.width = '0%';
                this.progressBar.style.opacity = '1';
                this.progressBar.style.transition = 'width 0.2s ease';
            }, 200);
        }, 200);
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