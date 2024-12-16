import { PageManager } from '../page_manager';
import { TurboEvent } from '../turbo_event';

describe('PageManager', () => {
    let pageManager: PageManager;
    let dispatchEventSpy: jest.SpyInstance;

    beforeEach(() => {
        pageManager = new PageManager();
        dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');
    });

    afterEach(() => {
        dispatchEventSpy.mockRestore();
        jest.clearAllMocks();
    });

    describe('Full Page Updates', () => {
        it('should perform a full page update', async () => {
            createTestPage(`
                <html>
                    <head><title>Initial Page</title></head>
                    <body>
                        <div id="content">Initial Content</div>
                        <div id="permanent" data-turbohref-permanent>Permanent Content</div>
                    </body>
                </html>
            `);

            const newDocument = new DOMParser().parseFromString(`
                <html>
                    <head><title>New Page</title></head>
                    <body>
                        <div id="content">New Content</div>
                        <div id="permanent" data-turbohref-permanent>Should Not Change</div>
                    </body>
                </html>
            `, 'text/html');

            await pageManager.update(newDocument);

            expect(document.title).toBe('New Page');
            expect(document.getElementById('content')?.textContent).toBe('New Content');
            expect(document.getElementById('permanent')?.textContent).toBe('Permanent Content');
        });

        it('should preserve permanent elements during full update', async () => {
            createTestPage(`
                <html>
                    <body>
                        <div id="p1" data-turbohref-permanent>Permanent 1</div>
                        <div id="p2" data-turbohref-permanent>Permanent 2</div>
                    </body>
                </html>
            `);

            const newDocument = new DOMParser().parseFromString(`
                <html>
                    <body>
                        <div id="p1" data-turbohref-permanent>Changed 1</div>
                        <div id="p2" data-turbohref-permanent>Changed 2</div>
                    </body>
                </html>
            `, 'text/html');

            await pageManager.update(newDocument);

            expect(document.getElementById('p1')?.textContent).toBe('Permanent 1');
            expect(document.getElementById('p2')?.textContent).toBe('Permanent 2');
        });
    });

    describe('Partial Updates', () => {
        it('should update only specified elements', async () => {
            createTestPage(`
                <html>
                    <body>
                        <div id="update1" data-turbohref-refresh="section1">Old Content 1</div>
                        <div id="update2" data-turbohref-refresh="section2">Old Content 2</div>
                        <div id="static">Static Content</div>
                    </body>
                </html>
            `);

            const newDocument = new DOMParser().parseFromString(`
                <html>
                    <body>
                        <div id="update1" data-turbohref-refresh="section1">New Content 1</div>
                        <div id="update2" data-turbohref-refresh="section2">New Content 2</div>
                        <div id="static">Changed Static</div>
                    </body>
                </html>
            `, 'text/html');

            await pageManager.update(newDocument, {
                partialReplace: true,
                onlyKeys: ['section1']
            });

            expect(document.getElementById('update1')?.textContent).toBe('New Content 1');
            expect(document.getElementById('update2')?.textContent).toBe('Old Content 2');
            expect(document.getElementById('static')?.textContent).toBe('Static Content');
        });

        it('should update everything except specified elements', async () => {
            createTestPage(`
                <html>
                    <body>
                        <div id="keep1" data-turbohref-refresh="keep">Keep Content 1</div>
                        <div id="keep2" data-turbohref-refresh="keep">Keep Content 2</div>
                        <div id="change">Old Content</div>
                    </body>
                </html>
            `);

            const newDocument = new DOMParser().parseFromString(`
                <html>
                    <body>
                        <div id="keep1" data-turbohref-refresh="keep">Changed 1</div>
                        <div id="keep2" data-turbohref-refresh="keep">Changed 2</div>
                        <div id="change">New Content</div>
                    </body>
                </html>
            `, 'text/html');

            await pageManager.update(newDocument, {
                partialReplace: true,
                exceptKeys: ['keep']
            });

            expect(document.getElementById('keep1')?.textContent).toBe('Keep Content 1');
            expect(document.getElementById('keep2')?.textContent).toBe('Keep Content 2');
            expect(document.getElementById('change')?.textContent).toBe('New Content');
        });
    });

    describe('Script Execution', () => {
        it('should execute new scripts', async () => {
            const scriptExecuted = jest.fn();
            window.scriptExecuted = scriptExecuted;

            createTestPage(`
                <html>
                    <body>
                        <div id="content">Initial Content</div>
                    </body>
                </html>
            `);

            const newDocument = new DOMParser().parseFromString(`
                <html>
                    <body>
                        <div id="content">New Content</div>
                        <script>window.scriptExecuted();</script>
                    </body>
                </html>
            `, 'text/html');

            await pageManager.update(newDocument);

            expect(scriptExecuted).toHaveBeenCalled();
        });

        it('should not execute scripts marked with data-turbohref-eval-false', async () => {
            const scriptExecuted = jest.fn();
            window.scriptExecuted = scriptExecuted;

            createTestPage(`
                <html>
                    <body>
                        <div id="content">Initial Content</div>
                    </body>
                </html>
            `);

            const newDocument = new DOMParser().parseFromString(`
                <html>
                    <body>
                        <div id="content">New Content</div>
                        <script data-turbohref-eval-false>window.scriptExecuted();</script>
                    </body>
                </html>
            `, 'text/html');

            await pageManager.update(newDocument);

            expect(scriptExecuted).not.toHaveBeenCalled();
        });
    });

    describe('Events', () => {
        it('should trigger appropriate events during update', async () => {
            createTestPage('<html><body>Initial</body></html>');
            const newDocument = new DOMParser().parseFromString(
                '<html><body>New</body></html>',
                'text/html'
            );

            await pageManager.update(newDocument);

            expect(dispatchEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TurboEvent.BeforeRender
                })
            );

            expect(dispatchEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TurboEvent.Render
                })
            );
        });
    });
}); 