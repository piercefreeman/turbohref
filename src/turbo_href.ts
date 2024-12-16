import { ClickHandler } from "./click_handler";
import { NavigationManager } from "./navigation_manager";
import { PageManager } from "./page_manager";
import { Events, TurboEvent } from "./events";

export class TurboHref {
    private static instance: TurboHref | null = null;
    private clickHandler: ClickHandler;
    private pageManager: PageManager;
    private navigationManager: NavigationManager;
    private events: Events;

    private constructor() {
        this.clickHandler = new ClickHandler();
        this.pageManager = new PageManager();
        this.navigationManager = new NavigationManager(this.pageManager);
        this.events = new Events();
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
        this.events.trigger(TurboEvent.Ready);
    }

    public stop(): void {
        this.clickHandler.stop();
        this.navigationManager.stop();
    }

    public visit(url: string, options: VisitOptions = {}): void {
        this.navigationManager.visit(url, options);
    }
}

export interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
} 