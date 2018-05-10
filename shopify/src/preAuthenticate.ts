import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

import { Log } from "./lib/log";

export async function preAuthenticate(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("PreAuthenticate", event);

    if (event.userName) {
        event.userName = event.userName.toLowerCase();
    }
    event.request.userAttributes.email = event.request.userAttributes.email.toLowerCase();

    return event;
}
