import { PageManager } from './page_manager';
import { Events, TurboEvent } from './events';

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
    private events: Events;

    constructor(pageManager: PageManager, options: NavigationManagerOptions = {}) {
        this.pageManager = pageManager;
        this.isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
        this.color = options.color || 'rgb(0, 118, 255)';
        this.height = options.height || 3;
        this.progressBar = this.createProgressBar();
        this.events = new Events();
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
        window.addEventListener(TurboEvent.Click, ((event: CustomEvent) => {
            this.visit(event.detail.url);
        }) as EventListener);

        // Listen for turbohref events to show/hide progress
        this.events.on(TurboEvent.BeforeRender, () => {
            this.showProgress();
        });

        this.events.on(TurboEvent.Render, () => {
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
        if (!this.events.trigger(TurboEvent.BeforeVisit, { url })) {
            return;
        }

        // Cancel any in-flight requests
        if (this.currentRequest) {
            this.currentRequest.abort();
            this.currentRequest = null;
        }

        const thisRequest = new AbortController();
        this.currentRequest = thisRequest;

        try {
            // If this request is no longer current, don't proceed
            if (this.currentRequest !== thisRequest) {
                return;
            }

            const response = await this.fetchPage(url, thisRequest.signal);
            
            // Check again if this request is still current
            if (this.currentRequest !== thisRequest) {
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            
            // Check one more time before processing the response
            if (this.currentRequest !== thisRequest) {
                return;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            await this.pageManager.update(doc, options);

            if (!options.partialReplace) {
                window.history.pushState({ turbohref: true }, '', url);
            }

            this.events.trigger(TurboEvent.Visit, { url });
            
            if (options.callback) {
                options.callback();
            }
        } catch (error) {
            // Only handle errors for the current request
            if (this.currentRequest !== thisRequest) {
                return;
            }

            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            this.events.trigger(TurboEvent.Error, { error: error as Error });
            
            // In test environment, just trigger an event instead of actual navigation
            if (this.isTestEnvironment) {
                this.events.trigger(TurboEvent.FallbackNavigation, { url });
            } else {
                window.location.href = url;
            }
        } finally {
            if (this.currentRequest === thisRequest) {
                this.currentRequest = null;
            }
        }
    }

    private async fetchPage(url: string, signal: AbortSignal): Promise<Response> {
        let fetchOptions: RequestInit = {
            method: 'GET',
            headers: {
                'Accept': 'text/html, application/xhtml+xml',
                'X-Requested-With': 'TurboHref'
            },
            credentials: 'same-origin',
            signal
        };

        // Allow users to modify the fetch options
        this.events.trigger(TurboEvent.BeforeRequest, {
            url,
            options: fetchOptions,
            setOptions: (newOptions: Partial<RequestInit>) => {
                // Merge the new options, preserving the signal
                fetchOptions = {
                    ...fetchOptions,
                    ...newOptions,
                    // Ensure signal can't be overridden
                    signal,
                    // Merge headers if both exist
                    headers: {
                        ...fetchOptions.headers,
                        ...(newOptions.headers || {}),
                    }
                };
            }
        });

        const response = await fetch(url, fetchOptions);

        // Get the total size from content-length header
        const contentLength = response.headers.get('content-length');
        
        // If we can't get the content length, return the original response
        if (!contentLength) {
            return response;
        }

        const total = parseInt(contentLength, 10);
        let loaded = 0;

        // Create a new ReadableStream to track progress
        const progressBar = this.progressBar;
        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body!.getReader();
                
                try {
                    while (true) {
                        const {done, value} = await reader.read();
                        
                        if (done) {
                            controller.close();
                            break;
                        }

                        loaded += value.length;
                        const progress = (loaded / total) * 100;
                        // Update progress bar - interpolate between 0-80%
                        const adjustedProgress = (progress * 0.8);
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

    private handlePopState(event: PopStateEvent): void {
        if (event.state?.turbohref) {
            this.visit(window.location.href);
        }
    }
} 