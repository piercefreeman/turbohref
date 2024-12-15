import { ClickHandler } from "./click_handler";
import { NavigationManager } from "./navigation_manager";
import { PageManager } from "./page_manager";

export class TurboHref {
    private static instance: TurboHref | null = null;
    private clickHandler: ClickHandler;
    private pageManager: PageManager;
    private navigationManager: NavigationManager;

    private constructor() {
        this.clickHandler = new ClickHandler();
        this.pageManager = new PageManager();
        this.navigationManager = new NavigationManager(this.pageManager);
    }

    public static getInstance(): TurboHref {
        if (!TurboHref.instance) {
            TurboHref.instance = new TurboHref();
        }
        return TurboHref.instance;
    }

    public start(): void {
        this.clickHandler.start();
        this.navigationManager.start();
        this.triggerEvent('turbohref:ready');
    }

    public stop(): void {
        this.clickHandler.stop();
        this.navigationManager.stop();
    }

    public visit(url: string, options: VisitOptions = {}): void {
        this.navigationManager.visit(url, options);
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

export interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
} 