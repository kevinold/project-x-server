import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

const autoConfirmDomains = [
    "@myshopify.com",
];

// Cognito User Pool Pre SignUp trigger to make sure the email address is stored as lower case.
export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    console.log("Event", event);

    if (event.request.userAttributes.email) {
        for (const domain of autoConfirmDomains) {
            if (event.request.userAttributes.email.endsWith(domain)) {
                // @ts-ignore
                event.response = {
                    autoConfirmUser: true,
                };
            }
        }
    }

    console.log("Response", event.response);

    return event;
}
