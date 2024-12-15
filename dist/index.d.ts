declare class TurboHref {
    private eventManager;
    private turboLinks;
    private turboGraft;
    private activeDocument;
    constructor(document?: Document);
    activate(): void;
    setActiveDocument(document: Document): void;
}

export { TurboHref };
