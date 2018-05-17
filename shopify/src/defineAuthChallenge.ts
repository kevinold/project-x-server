import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    console.log("Event", event);

    if (!event.request.session || event.request.session.length === 0) {
        // If we don't have a session or it is empty then issue a CUSTOM_CHALLENGE
        event.response.challengeName = "CUSTOM_CHALLENGE";
        event.response.failAuthentication = false;
        event.response.issueTokens = false;
    } else if (event.request.session.length === 1) {
        // If we passed the CUSTOM_CHALLENGE then issue token
        event.response.failAuthentication = false;
        event.response.issueTokens = true;
    } else {
        // Something is wrong. Fail authentication
        event.response.failAuthentication = true;
        event.response.issueTokens = false;
    }

    console.log("Response", event.response);

    return event;
}
