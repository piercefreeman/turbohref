export declare class TurboHref {
    private static instance;
    private clickHandler;
    private pageManager;
    private navigationManager;
    private constructor();
    static getInstance(): TurboHref;
    start(): void;
    stop(): void;
    visit(url: string, options?: VisitOptions): void;
    private triggerEvent;
}
export interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
}
//# sourceMappingURL=TurboHref.d.ts.map