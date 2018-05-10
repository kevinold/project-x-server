import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

import { Log } from "./lib/log";

export async function preSignUp(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("PreSignUp", event);

    event.request.userAttributes.email = event.request.userAttributes.email.toLowerCase();
    event.response = {
        autoConfirmUser: true,
    };
    if (event.request.userAttributes.email) {
        // @ts-ignore
        event.response.autoVerifyEmail = true;
    }
    if (event.request.userAttributes.phone_number) {
        // @ts-ignore
        event.response.autoVerifyPhone = true;
    }

    return event;
}
