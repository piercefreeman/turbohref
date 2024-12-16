declare class TurboHref {
    private static instance;
    private clickHandler;
    private pageManager;
    private navigationManager;
    private events;
    constructor();
    static getInstance(): TurboHref;
    start(): void;
    stop(): void;
    visit(url: string, options?: VisitOptions): void;
}
interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
}

declare enum TurboEvent {
    BeforeVisit = "turbohref:before-visit",
    Visit = "turbohref:visit",
    BeforeRender = "turbohref:before-render",
    Render = "turbohref:render",
    Error = "turbohref:error",
    FallbackNavigation = "turbohref:fallback-navigation",
    Click = "turbohref:click",
    Ready = "turbohref:ready",
    BeforeRequest = "turbohref:before-request"
}

export { TurboEvent, TurboHref };
