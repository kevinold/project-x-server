import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    console.log("Event", event);

    if (!event.request.session || event.request.session.length === 0) {
        // For the first challenge ask for a JWT token
        event.response.publicChallengeParameters = {
            distraction: "Yes",
        };
        event.response.privateChallengeParameters = {
            distraction: "Yes",
        };
        // @ts-ignore
        event.response.challengeMetadata = "JWT";
    }

    console.log("Response", event.response);

    return event;
}
