import { NavigationManager } from '../navigation_manager';
import { PageManager } from '../page_manager';
import { TurboEvent } from '../events';

describe('NavigationManager', () => {
    let navigationManager: NavigationManager;
    let pageManager: PageManager;
    let dispatchEventSpy: jest.SpyInstance;
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        pageManager = new PageManager();
        navigationManager = new NavigationManager(pageManager);
        dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');
        fetchSpy = jest.spyOn(window, 'fetch');

        // Setup initial page
        createTestPage(`
            <html>
                <head><title>Initial Page</title></head>
                <body>
                    <div id="content" data-turbohref-refresh="content">Initial Content</div>
                </body>
            </html>
        `);
    });

    afterEach(() => {
        navigationManager.stop();
        dispatchEventSpy.mockRestore();
        fetchSpy.mockRestore();
        jest.clearAllMocks();
    });

    it('should handle successful page visits', async () => {
        const newPageHtml = `
            <html>
                <head><title>New Page</title></head>
                <body>
                    <div id="content">New Content</div>
                </body>
            </html>
        `;

        fetchSpy.mockResolvedValueOnce(createMockResponse(newPageHtml));
        const pushStateSpy = jest.spyOn(window.history, 'pushState');

        await navigationManager.visit('/new-page');
        await flushPromises();

        expect(fetchSpy).toHaveBeenCalledWith(
            '/new-page',
            expect.objectContaining({
                method: 'GET',
                credentials: 'same-origin'
            })
        );

        expect(dispatchEventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: TurboEvent.Visit
            })
        );

        expect(pushStateSpy).toHaveBeenCalledWith(
            { turbohref: true },
            '',
            '/new-page'
        );

        expect(document.title).toBe('New Page');
        expect(document.getElementById('content')?.textContent).toBe('New Content');
    });

    it('should handle failed page visits', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('Network error'));

        await navigationManager.visit('/error-page');
        await flushPromises();

        expect(dispatchEventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: TurboEvent.Error
            })
        );

        expect(dispatchEventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: TurboEvent.FallbackNavigation,
                detail: { url: '/error-page' }
            })
        );
    });

    it('should handle partial page updates', async () => {
        const newPageHtml = `
            <html>
                <head><title>Partial Update</title></head>
                <body>
                    <div id="content" data-turbohref-refresh="content">Updated Content</div>
                </body>
            </html>
        `;

        fetchSpy.mockResolvedValueOnce(createMockResponse(newPageHtml));
        const pushStateSpy = jest.spyOn(window.history, 'pushState');

        await navigationManager.visit('/partial', { 
            partialReplace: true,
            onlyKeys: ['content']
        });
        await flushPromises();

        expect(pushStateSpy).not.toHaveBeenCalled();
        expect(document.getElementById('content')?.textContent).toBe('Updated Content');
    });

    it('should cancel in-flight requests', async () => {
        const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
        
        // Create a promise that we can control
        let resolveFirst!: () => void;
        const firstFetch = new Promise<Response>(resolve => {
            resolveFirst = () => resolve(createMockResponse('<html><body>First</body></html>'));
        });
        
        // First request will be pending
        fetchSpy.mockImplementationOnce(() => firstFetch);
        // Second request will resolve immediately
        fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>Second</body></html>'));

        // Start first request
        const firstPromise = navigationManager.visit('/first');
        
        // Start second request before first completes
        const secondPromise = navigationManager.visit('/second');
        
        // Now resolve the first request
        resolveFirst();
        
        await Promise.all([firstPromise, secondPromise]);
        await flushPromises();

        expect(abortSpy).toHaveBeenCalledTimes(1);
        expect(document.body.textContent).toBe('Second');
    }, 1000);

    it('should handle popstate events', async () => {
        const visitSpy = jest.spyOn(navigationManager, 'visit');
        navigationManager.start();

        // Simulate a popstate event
        const popStateEvent = new PopStateEvent('popstate', {
            state: { turbohref: true }
        });
        window.dispatchEvent(popStateEvent);

        expect(visitSpy).toHaveBeenCalledWith(window.location.href);
    });

    it('should ignore non-turbohref popstate events', () => {
        const visitSpy = jest.spyOn(navigationManager, 'visit');
        navigationManager.start();

        // Simulate a regular popstate event
        const popStateEvent = new PopStateEvent('popstate', {
            state: null
        });
        window.dispatchEvent(popStateEvent);

        expect(visitSpy).not.toHaveBeenCalled();
    });

    it('should execute callback after successful visit', async () => {
        const callback = jest.fn();
        fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>New Content</body></html>'));

        await navigationManager.visit('/callback-test', { callback });
        await flushPromises();

        expect(callback).toHaveBeenCalled();
    });

    describe('Request Customization', () => {
        it('should trigger beforeRequest event with default options', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>New Content</body></html>'));
            
            let capturedOptions: RequestInit | null = null;
            document.addEventListener(TurboEvent.BeforeRequest, ((event: CustomEvent) => {
                capturedOptions = event.detail.options;
            }) as EventListener);

            await navigationManager.visit('/test');
            await flushPromises();

            expect(capturedOptions).toEqual({
                method: 'GET',
                headers: {
                    'Accept': 'text/html, application/xhtml+xml',
                    'X-Requested-With': 'TurboHref'
                },
                credentials: 'same-origin',
                signal: expect.any(AbortSignal)
            });
        });

        it('should allow modifying request headers', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>New Content</body></html>'));
            
            document.addEventListener(TurboEvent.BeforeRequest, ((event: CustomEvent) => {
                event.detail.setOptions({
                    headers: {
                        'Authorization': 'Bearer token123'
                    }
                });
            }) as EventListener);

            await navigationManager.visit('/test');
            await flushPromises();

            expect(fetchSpy).toHaveBeenCalledWith('/test', expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer token123',
                    'Accept': 'text/html, application/xhtml+xml',
                    'X-Requested-With': 'TurboHref'
                })
            }));
        });

        it('should allow multiple listeners to modify options', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>New Content</body></html>'));
            
            // First listener adds authorization
            document.addEventListener(TurboEvent.BeforeRequest, ((event: CustomEvent) => {
                event.detail.setOptions({
                    headers: {
                        'Authorization': 'Bearer token123'
                    }
                });
            }) as EventListener);

            // Second listener adds custom header
            document.addEventListener(TurboEvent.BeforeRequest, ((event: CustomEvent) => {
                event.detail.setOptions({
                    headers: {
                        'X-Custom': 'value'
                    }
                });
            }) as EventListener);

            await navigationManager.visit('/test');
            await flushPromises();

            expect(fetchSpy).toHaveBeenCalledWith('/test', expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer token123',
                    'X-Custom': 'value',
                    'Accept': 'text/html, application/xhtml+xml',
                    'X-Requested-With': 'TurboHref'
                })
            }));
        });

        it('should prevent overriding the abort signal', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>New Content</body></html>'));
            
            const customSignal = new AbortController().signal;
            document.addEventListener(TurboEvent.BeforeRequest, ((event: CustomEvent) => {
                event.detail.setOptions({
                    signal: customSignal
                });
            }) as EventListener);

            await navigationManager.visit('/test');
            await flushPromises();

            // Verify that the fetch was called with the original signal, not our custom one
            const fetchCall = fetchSpy.mock.calls[0][1];
            expect(fetchCall.signal).not.toBe(customSignal);
        });

        it('should allow modifying other fetch options', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse('<html><body>New Content</body></html>'));
            
            document.addEventListener(TurboEvent.BeforeRequest, ((event: CustomEvent) => {
                event.detail.setOptions({
                    credentials: 'include',
                    mode: 'cors',
                    cache: 'no-cache'
                });
            }) as EventListener);

            await navigationManager.visit('/test');
            await flushPromises();

            expect(fetchSpy).toHaveBeenCalledWith('/test', expect.objectContaining({
                credentials: 'include',
                mode: 'cors',
                cache: 'no-cache'
            }));
        });
    });
}); 