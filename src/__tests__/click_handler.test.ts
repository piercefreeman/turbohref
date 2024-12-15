import { ClickHandler } from '../click_handler';

describe('ClickHandler', () => {
    let clickHandler: ClickHandler;
    let dispatchEventSpy: jest.SpyInstance;

    beforeEach(() => {
        clickHandler = new ClickHandler();
        dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');
        createTestPage(`
            <a href="/page1" id="normal-link">Normal Link</a>
            <a href="/page2" target="_blank" id="new-tab">New Tab Link</a>
            <a href="/page3" download id="download">Download Link</a>
            <a href="/page4" data-turbohref-ignore id="ignored">Ignored Link</a>
            <a href="https://external.com" id="external">External Link</a>
        `);
    });

    afterEach(() => {
        clickHandler.stop();
        dispatchEventSpy.mockRestore();
    });

    it('should handle normal link clicks', () => {
        clickHandler.start();
        const link = document.getElementById('normal-link') as HTMLAnchorElement;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        
        link.dispatchEvent(event);

        expect(dispatchEventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'turbohref:click',
                detail: expect.objectContaining({
                    url: expect.stringContaining('/page1'),
                    link
                })
            })
        );
        expect(event.defaultPrevented).toBe(true);
    });

    it('should ignore links with target="_blank"', () => {
        clickHandler.start();
        const link = document.getElementById('new-tab') as HTMLAnchorElement;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        
        link.dispatchEvent(event);

        expect(dispatchEventSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('should ignore download links', () => {
        clickHandler.start();
        const link = document.getElementById('download') as HTMLAnchorElement;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        
        link.dispatchEvent(event);

        expect(dispatchEventSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('should ignore links with data-turbohref-ignore', () => {
        clickHandler.start();
        const link = document.getElementById('ignored') as HTMLAnchorElement;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        
        link.dispatchEvent(event);

        expect(dispatchEventSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('should ignore external links', () => {
        clickHandler.start();
        const link = document.getElementById('external') as HTMLAnchorElement;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        
        link.dispatchEvent(event);

        expect(dispatchEventSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('should ignore modified clicks (ctrl, shift, etc)', () => {
        clickHandler.start();
        const link = document.getElementById('normal-link') as HTMLAnchorElement;
        const modifiers = ['ctrlKey', 'shiftKey', 'altKey', 'metaKey'];

        modifiers.forEach(modifier => {
            const event = new MouseEvent('click', { 
                bubbles: true, 
                cancelable: true,
                [modifier]: true 
            });
            
            link.dispatchEvent(event);

            expect(dispatchEventSpy).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        });
    });

    it('should ignore right clicks', () => {
        clickHandler.start();
        const link = document.getElementById('normal-link') as HTMLAnchorElement;
        const event = new MouseEvent('click', { 
            bubbles: true, 
            cancelable: true,
            button: 2 // Right click
        });
        
        link.dispatchEvent(event);

        expect(dispatchEventSpy).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('should properly clean up event listeners on stop', () => {
        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

        clickHandler.start();
        clickHandler.stop();

        expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
        expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
            'click',
            expect.any(Function),
            true
        );
    });
}); 