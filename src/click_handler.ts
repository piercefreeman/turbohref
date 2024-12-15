export class ClickHandler {
    private static readonly CLICK_SELECTOR = 'a[href]:not([target]):not([download]):not([data-turbohref-ignore])';
    private boundClickHandler: (event: MouseEvent) => void;

    constructor() {
        this.boundClickHandler = this.handleClick.bind(this);
    }

    public start(): void {
        document.addEventListener('click', this.boundClickHandler, true);
    }

    public stop(): void {
        document.removeEventListener('click', this.boundClickHandler, true);
    }

    private handleClick(event: MouseEvent): void {
        const link = this.findLinkFromClickTarget(event);
        if (!link) return;

        const url = new URL(link.href);
        const isSameOrigin = url.origin === window.location.origin;
        const isLeftClick = event.button === 0;
        const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

        if (isSameOrigin && isLeftClick && !isModified) {
            event.preventDefault();
            this.triggerEvent('turbohref:click', { url: url.toString(), link });
        }
    }

    private findLinkFromClickTarget(event: MouseEvent): HTMLAnchorElement | null {
        const target = event.target as HTMLElement;
        const link = target.closest(ClickHandler.CLICK_SELECTOR);
        return link as HTMLAnchorElement;
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