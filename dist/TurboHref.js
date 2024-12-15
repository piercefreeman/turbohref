import { ClickHandler } from "./ClickHandler";
import { NavigationManager } from "./NavigationManager";
import { PageManager } from "./PageManager";
export class TurboHref {
    constructor() {
        this.clickHandler = new ClickHandler();
        this.pageManager = new PageManager();
        this.navigationManager = new NavigationManager(this.pageManager);
    }
    static getInstance() {
        if (!TurboHref.instance) {
            TurboHref.instance = new TurboHref();
        }
        return TurboHref.instance;
    }
    start() {
        this.clickHandler.start();
        this.navigationManager.start();
        this.triggerEvent('turbohref:ready');
    }
    stop() {
        this.clickHandler.stop();
        this.navigationManager.stop();
    }
    visit(url, options = {}) {
        this.navigationManager.visit(url, options);
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
TurboHref.instance = null;
//# sourceMappingURL=TurboHref.js.map