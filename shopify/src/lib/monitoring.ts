export function withMonitoring<TEvent, TContext, TResult>(
    handler: (event: TEvent, context: TContext, callback: (error: Error, result: TResult) => void) => void,
): (event: TEvent, context: TContext, callback: (error: Error, result: TResult) => void) => void {
    return (event: TEvent, context: TContext, callback: (error: Error, result: TResult) => void) => {
        console.log("monitoring", { type: "event", data: event });
        console.log("monitoring", { type: "context", data: context });
        handler(event, context, (error: Error, result: any) => {
            if (!error) {
                console.log("monitoring", { type: "result", data: result });
            } else {
                console.log("monitoring", { type: "error", data: error });
            }
            callback(error, result);
        });
    };
}

export function withAsyncMonitoring<TEvent, TContext, TResult>(
    handler: (event: TEvent, context: TContext) => Promise<TResult>,
): (event: TEvent, context: TContext) => Promise<TResult> {
    return async (event: TEvent, context: TContext): Promise<TResult> => {
        console.log("monitoring", { type: "event", data: event });
        console.log("monitoring", { type: "context", data: context });
        try {
            const result = await handler(event, context);
            console.log("monitoring", { type: "result", data: result });
            return result;
        } catch (error) {
            console.log("monitoring", { type: "error", data: error });
            throw error;
        }
    };
}
