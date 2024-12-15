export class ClickHandler {
    constructor() {
        this.boundClickHandler = this.handleClick.bind(this);
    }
    start() {
        document.addEventListener('click', this.boundClickHandler, true);
    }
    stop() {
        document.removeEventListener('click', this.boundClickHandler, true);
    }
    handleClick(event) {
        const link = this.findLinkFromClickTarget(event);
        if (!link)
            return;
        const url = new URL(link.href);
        const isSameOrigin = url.origin === window.location.origin;
        const isLeftClick = event.button === 0;
        const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (isSameOrigin && isLeftClick && !isModified) {
            event.preventDefault();
            this.triggerEvent('turbohref:click', { url: url.toString(), link });
        }
    }
    findLinkFromClickTarget(event) {
        const target = event.target;
        const link = target.closest(ClickHandler.CLICK_SELECTOR);
        return link;
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
ClickHandler.CLICK_SELECTOR = 'a[href]:not([target]):not([download]):not([data-turbohref-ignore])';
//# sourceMappingURL=ClickHandler.js.map