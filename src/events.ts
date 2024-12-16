export enum TurboEvent {
    BeforeVisit = 'turbohref:before-visit',
    Visit = 'turbohref:visit',
    BeforeRender = 'turbohref:before-render',
    Render = 'turbohref:render',
    Error = 'turbohref:error',
    FallbackNavigation = 'turbohref:fallback-navigation',
    Click = 'turbohref:click',
    Ready = 'turbohref:ready',
    BeforeRequest = 'turbohref:before-request',
}

interface TurboEventPayloads {
    [TurboEvent.BeforeVisit]: { url: string };
    [TurboEvent.Visit]: { url: string };
    [TurboEvent.BeforeRender]: Record<string, never>;
    [TurboEvent.Render]: Record<string, never>;
    [TurboEvent.Error]: { error: Error };
    [TurboEvent.FallbackNavigation]: { url: string };
    [TurboEvent.Click]: { url: string; link: HTMLAnchorElement };
    [TurboEvent.Ready]: Record<string, never>;
    [TurboEvent.BeforeRequest]: {
        url: string;
        options: RequestInit;
        // Allow modifying the options by reference
        setOptions: (newOptions: Partial<RequestInit>) => void;
    };
}

export class Events {
    public trigger<T extends TurboEvent>(
        eventName: T,
        detail: TurboEventPayloads[T] = {} as TurboEventPayloads[T]
    ): boolean {
        const event = new CustomEvent(eventName, {
            bubbles: true,
            cancelable: true,
            detail
        });
        return document.dispatchEvent(event);
    }

    public on<T extends TurboEvent>(
        eventName: T,
        handler: (event: CustomEvent<TurboEventPayloads[T]>) => void
    ): void {
        document.addEventListener(eventName, handler as EventListener);
    }

    public off<T extends TurboEvent>(
        eventName: T,
        handler: (event: CustomEvent<TurboEventPayloads[T]>) => void
    ): void {
        document.removeEventListener(eventName, handler as EventListener);
    }
} 