import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

import { Log } from "./lib/log";

const autoConfirmDomains = [
    "@myshopify.com",
];

// Cognito User Pool Pre SignUp trigger to make sure the email address is stored as lower case.
export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("PreSignUp", event);

    if (event.request.userAttributes.email) {
        for (const domain in autoConfirmDomains) {
            if (event.request.userAttributes.email.endsWith(domain)) {
                // @ts-ignore
                event.response = {
                    autoConfirmUser: true,
                };

                return event;
            }
        }
    }

    return event;
}
