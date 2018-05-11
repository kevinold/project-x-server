import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

import { Log } from "./lib/log";

export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("CreateAuthChallenge Event", event);
    Log.info("CreateAuthChallenge Request", event.request);
    Log.info("CreateAuthChallenge Response", event.response);
    console.log("CreateAuthChallenge Event", event);
    console.log("CreateAuthChallenge Request", event.request);
    console.log("CreateAuthChallenge Response (In)", event.response);

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
    console.log("CreateAuthChallenge Response (Out)", event.response);

    return event;
}
