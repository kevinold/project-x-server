export function withMonitoring<TEvent, TContext, TResult>(
    handler: (event: TEvent, context: TContext, callback: (error: Error, result: TResult) => void) => void,
): (event: TEvent, context: TContext, callback: (error: Error, result: TResult) => void) => void {
    return (event: TEvent, context: TContext, callback: (error: Error, result: TResult) => void) => {
        console.log("monitoring-event", event);
        console.log("monitoring-context", context);
        handler(event, context, (error: Error, result: any) => {
            if (!error) {
                console.log("monitoring-result", result);
            } else {
                console.log("monitoring-error", error);
            }
            callback(error, result);
        });
    };
}

export function withAsyncMonitoring<TEvent, TContext, TResult>(
    handler: (event: TEvent, context: TContext) => Promise<TResult>,
): (event: TEvent, context: TContext) => Promise <TResult> {
    return async (event: TEvent, context: TContext): Promise<TResult> => {
        console.log("monitoring-event", event);
        console.log("monitoring-context", context);
        try {
            const result = await handler(event, context);
            console.log("monitoring-result", result);
            return result;
        } catch (error) {
            console.log("monitoring-error", error);
            throw error;
        }
    };
}
