import "source-map-support/register";

import { CognitoUserPoolEvent } from "aws-lambda";

import { Log } from "./lib/log";

export async function handler(event: CognitoUserPoolEvent): Promise<CognitoUserPoolEvent> {
    Log.info("DefineAuthChallenge Event", event);
    Log.info("DefineAuthChallenge Request", event.request);
    Log.info("DefineAuthChallenge Response", event.response);
    console.log("DefineAuthChallenge Event", event);
    console.log("DefineAuthChallenge Request", event.request);
    console.log("DefineAuthChallenge Response (In)", event.response);

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

    console.log("DefineAuthChallenge Response (Out)", event.response);

    // tslint:disable-next-line:max-line-length
    // if (event.request.session && event.request.session.length === 1 && event.request.session[0].challengeName === "CUSTOM_CHALLENGE") {
    //     event.response.publicChallengeParameters = {};
    //     event.response.privateChallengeParameters = {};
    //     event.response.challengeMetaData = "JWT";
    // }

    return event;
}
