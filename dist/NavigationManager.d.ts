import { PageManager } from './PageManager';
export interface VisitOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
    headers?: Record<string, string>;
    callback?: () => void;
}
export declare class NavigationManager {
    private currentRequest;
    private pageManager;
    private isTestEnvironment;
    constructor(pageManager: PageManager);
    start(): void;
    stop(): void;
    visit(url: string, options?: VisitOptions): Promise<void>;
    private fetchPage;
    private handlePopState;
    private triggerEvent;
}
//# sourceMappingURL=NavigationManager.d.ts.map