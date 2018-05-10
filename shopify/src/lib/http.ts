import { ProxyResult } from "aws-lambda";

export function badRequest(message: string): ProxyResult {
    return {
        body: JSON.stringify({
            message,
        }),
        headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
        statusCode: 400,
    };
}
